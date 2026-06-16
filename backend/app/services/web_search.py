from dataclasses import dataclass
from datetime import date
import json
import re
from typing import Protocol
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.schemas import KnowledgeSource
from app.services.mimo import MimoClient
from app.services.rag import RetrievedContext


class WebSearchTimeout(RuntimeError):
    pass


@dataclass(frozen=True)
class WebSearchResult:
    title: str
    snippet: str
    url: str
    source_level: str = "ordinary"


class WebSearchProvider(Protocol):
    def search(self, query: str, timeout_seconds: float) -> list[WebSearchResult | dict]:
        ...


class DisabledWebSearchProvider:
    def search(self, query: str, timeout_seconds: float) -> list[WebSearchResult]:
        return []


class HttpJsonWebSearchProvider:
    def __init__(self, endpoint: str, api_key: str = "") -> None:
        self.endpoint = endpoint
        self.api_key = api_key

    def search(self, query: str, timeout_seconds: float) -> list[WebSearchResult]:
        if not self.endpoint:
            return []

        payload = json.dumps({"query": query}, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        request = Request(self.endpoint, data=payload, headers=headers, method="POST")
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except TimeoutError as exc:
            raise WebSearchTimeout("web search timed out") from exc
        except URLError as exc:
            if isinstance(exc.reason, TimeoutError):
                raise WebSearchTimeout("web search timed out") from exc
            raise

        data = json.loads(raw)
        return [_result_from_mapping(item) for item in data.get("results", [])]


class MimoWebSearchProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def search(self, query: str, timeout_seconds: float) -> list[WebSearchResult]:
        if not self.settings.llm_api_key:
            return []

        client = MimoClient(self.settings.llm_base_url, self.settings.llm_api_key)
        today = date.today().strftime("%Y年%m月%d日")
        response = client.web_search_completion(
            model=self.settings.llm_model,
            system_prompt=_mimo_search_system_prompt(),
            user_prompt=f"今天是{today}。请联网搜索并提取可核验来源来回答这个实时或公共信息问题：{query}",
            max_results=self.settings.web_search_max_results,
            timeout_seconds=timeout_seconds,
        )
        return _mimo_response_to_results(response)


def get_web_search_provider(settings: Settings) -> WebSearchProvider:
    if settings.web_search_mode in {"mimo", "provider"}:
        return MimoWebSearchProvider(settings)
    if settings.web_search_mode == "http_json":
        return HttpJsonWebSearchProvider(
            settings.web_search_endpoint,
            settings.web_search_api_key,
        )
    return DisabledWebSearchProvider()


def web_results_to_contexts(
    results: list[WebSearchResult | dict],
    classification: dict,
    max_results: int,
) -> list[RetrievedContext]:
    allowed_levels = _allowed_source_levels(classification)
    normalized = [
        result
        for result in (_normalize_result(item) for item in results)
        if result.url and result.snippet and result.source_level in allowed_levels
    ]
    ranked = sorted(
        normalized,
        key=lambda result: (_source_priority(result.source_level), result.title),
    )
    return [_context_from_result(result, score) for score, result in enumerate(ranked[:max_results])]


def _normalize_result(item: WebSearchResult | dict) -> WebSearchResult:
    if isinstance(item, WebSearchResult):
        return item
    return _result_from_mapping(item)


def _result_from_mapping(item: dict) -> WebSearchResult:
    return WebSearchResult(
        title=str(item.get("title", "联网搜索结果")),
        snippet=str(item.get("snippet", "")),
        url=str(item.get("url", "")),
        source_level=str(item.get("source_level", "ordinary")),
    )


def _context_from_result(result: WebSearchResult, index: int) -> RetrievedContext:
    return RetrievedContext(
        source=KnowledgeSource(
            title=result.title,
            spot_name=None,
            section="基于联网搜索",
            snippet=result.snippet,
            score=700 - index,
            source_type="realtime_web",
            source_url=result.url,
            source_level=result.source_level,
        ),
        text=f"{result.title} {result.snippet} {result.url} {result.source_level}",
    )


def _allowed_source_levels(classification: dict) -> set[str]:
    fact_keys = set(classification.get("fact_keys", []))
    if classification.get("intent") == "high_risk_realtime":
        return {"official", "authoritative"}
    if fact_keys.intersection({"opening_time", "ticket"}):
        return {"official", "authoritative"}
    return {"official", "authoritative", "ordinary"}


def _source_priority(source_level: str) -> int:
    return {
        "official": 0,
        "authoritative": 1,
        "ordinary": 2,
    }.get(source_level, 9)


def _mimo_response_to_results(response: dict) -> list[WebSearchResult]:
    content = str(response.get("content", ""))
    results: list[WebSearchResult] = []
    for annotation in response.get("annotations", []):
        if annotation.get("type") != "url_citation":
            continue
        citation = annotation.get("url_citation") or annotation
        url = str(citation.get("url", ""))
        snippet = str(citation.get("summary") or citation.get("content") or content)
        results.append(
            WebSearchResult(
                title=str(citation.get("title") or citation.get("site_name") or "联网搜索结果"),
                snippet=snippet,
                url=url,
                source_level=_source_level_for_url(
                    url,
                    str(citation.get("title", "")),
                    str(citation.get("site_name", "")),
                ),
            )
        )
    return results or _results_from_content_urls(content) or _known_source_results_from_content(content)


def _results_from_content_urls(content: str) -> list[WebSearchResult]:
    urls = _content_urls(content)
    if not urls:
        return []
    return [
        WebSearchResult(
            title=_title_for_content_url(url, content),
            snippet=_clean_content_snippet(content),
            url=url,
            source_level=_source_level_for_url(url, content, ""),
        )
        for url in urls
    ]


def _content_urls(content: str) -> list[str]:
    urls = []
    for match in re.findall(r"https?://[^\s)）\]]+", content):
        url = match.rstrip("。；;，,、")
        if url not in urls:
            urls.append(url)
    return urls


def _title_for_content_url(url: str, content: str) -> str:
    if "weather.com.cn" in url:
        return "中国天气网"
    if "weather.cma.cn" in url or "cma.gov.cn" in url:
        return "中国气象服务"
    if "wuxi.gov.cn" in url:
        return "无锡政务信息"
    if "qq.com" in url:
        return "腾讯新闻"
    if "bocha.cn" in url:
        return "博查"
    if "lingshan" in url:
        return "灵山胜境官方信息"
    return "联网搜索结果"


def _clean_content_snippet(content: str) -> str:
    snippet = re.sub(r"https?://\S+", "", content).strip()
    snippet = re.sub(r"\n{3,}", "\n\n", snippet)
    return snippet[:800]


def _known_source_results_from_content(content: str) -> list[WebSearchResult]:
    known_sources = [
        ("中国天气网", "http://www.weather.com.cn/weather/101190201.shtml"),
        ("无锡市气象局", "http://wx.cma.gov.cn/"),
        ("无锡气象局", "http://wx.cma.gov.cn/"),
    ]
    snippet = _clean_content_snippet(content)
    results: list[WebSearchResult] = []
    for title, url in known_sources:
        if title not in content:
            continue
        if any(result.url == url for result in results):
            continue
        results.append(
            WebSearchResult(
                title=title,
                snippet=snippet,
                url=url,
                source_level=_source_level_for_url(url, title, ""),
            )
        )
    return results


def _source_level_for_url(url: str, title: str, site_name: str) -> str:
    text = f"{url} {title} {site_name}".lower()
    if any(term in text for term in ["lingshan.com", "lingshan.cn", "灵山胜境", "官方"]):
        return "official"
    if any(
        term in text
        for term in [
            "gov.cn",
            "文旅",
            "百科",
            "携程",
            "同程",
            "马蜂窝",
            "weather.com.cn",
            "weather.cma.cn",
            "cma.gov.cn",
            "qq.com",
            "腾讯",
            "bocha.cn",
            "博查",
        ]
    ):
        return "authoritative"
    return "ordinary"


def _mimo_search_system_prompt() -> str:
    return (
        "你是游知灵后端的联网事实检索器。"
        "只检索公开网页中可核验的事实，优先官方、政府文旅、气象服务、权威旅游平台和百科。"
        "不要编造来源；回答要简短，保留可用于引用的网页来源。"
    )
