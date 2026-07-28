import {
  CommentOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  LikeFilled,
  LikeOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Pagination,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPosts,
  setCommunityPostLiked,
} from '../../api/community';
import { getSpots } from '../../api/spots';
import type {
  CommunityPost,
  CommunityPostScope,
  CommunityPostSort,
} from '../../types/community';
import type { ScenicSpot } from '../../types/scenic';
import { toApiError } from '../../api/client';
import { useVisitorAuth } from '../../utils/visitorAuthContext';
import styles from './CommunityPage.module.css';

const PAGE_SIZE = 10;

type CommunityView = 'latest' | 'popular' | 'mine';

const avatarColors = ['#59766c', '#a65f49', '#7a6a4d', '#6f6883', '#527487'];

export default function CommunityPage() {
  const { user } = useVisitorAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [view, setView] = useState<CommunityView>('latest');
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [spotId, setSpotId] = useState<string>();
  const [spots, setSpots] = useState<ScenicSpot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingLikes, setPendingLikes] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number>();

  const scope: CommunityPostScope = view === 'mine' ? 'mine' : 'all';
  const sort: CommunityPostSort = view === 'popular' ? 'popular' : 'latest';

  const loadPosts = useCallback(() => {
    setLoading(true);
    setError('');
    getCommunityPosts({ scope, sort, page, pageSize: PAGE_SIZE })
      .then((result) => {
        setPosts(result.items);
        setTotal(result.total);
        if (result.items.length === 0 && page > 1) {
          setPage(Math.max(1, page - 1));
        }
      })
      .catch((loadError) => {
        setError(toApiError(loadError, '评论加载失败，请稍后重试。').message);
      })
      .finally(() => setLoading(false));
  }, [page, scope, sort]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    getSpots()
      .then(setSpots)
      .catch(() => setSpots([]));
  }, []);

  const spotOptions = useMemo(
    () => spots.map((spot) => ({ value: spot.id, label: spot.name })),
    [spots],
  );

  const handleViewChange = (nextView: string | number) => {
    setView(nextView as CommunityView);
    setPage(1);
  };

  const handlePublish = async () => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      messageApi.warning('先写下想分享的内容。');
      return;
    }

    setSubmitting(true);
    try {
      await createCommunityPost({ content: normalizedContent, spotId });
      setContent('');
      setSpotId(undefined);
      setView('latest');
      setPage(1);
      messageApi.success('留言已发布，其他游客现在可以看到了。');
      if (view === 'latest' && page === 1) {
        loadPosts();
      }
    } catch (publishError) {
      messageApi.error(toApiError(publishError, '发布失败，请稍后重试。').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (pendingLikes.has(post.id) || post.status !== 'published') return;

    const nextLiked = !post.likedByMe;
    setPendingLikes((current) => new Set(current).add(post.id));
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likedByMe: nextLiked,
              likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)),
            }
          : item,
      ),
    );

    try {
      const result = await setCommunityPostLiked(post.id, nextLiked);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, likedByMe: result.liked, likeCount: result.like_count }
            : item,
        ),
      );
    } catch (likeError) {
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? post : item)),
      );
      messageApi.error(toApiError(likeError, '点赞操作失败。').message);
    } finally {
      setPendingLikes((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  };

  const handleDelete = async (postId: number) => {
    setDeletingId(postId);
    try {
      await deleteCommunityPost(postId);
      messageApi.success('留言已删除。');
      loadPosts();
    } catch (deleteError) {
      messageApi.error(toApiError(deleteError, '删除失败，请稍后重试。').message);
    } finally {
      setDeletingId(undefined);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#b86449',
          colorInfo: '#59766c',
          colorText: '#24231f',
          colorTextSecondary: '#68665f',
          colorBgContainer: '#fffefb',
          colorBgElevated: '#fffefb',
          colorBorder: '#d8d4cb',
          colorBorderSecondary: '#e9e5dd',
          borderRadius: 8,
          fontFamily:
            '"Microsoft YaHei", "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <div className={styles.page}>
        {contextHolder}
        <header className={styles.header}>
          <div>
            <Typography.Title level={1} className={styles.title}>
              评论社区
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              分享游览见闻，也看看其他游客留下的真实体验。
            </Typography.Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadPosts} loading={loading}>
            刷新
          </Button>
        </header>

        <div className={styles.layout}>
          <main className={styles.main}>
            <section className={styles.composer} aria-labelledby="community-composer-title">
              <div className={styles.composerIdentity}>
                <Avatar
                  size={42}
                  className={styles.avatar}
                  style={{ backgroundColor: avatarColor(user?.username ?? '') }}
                >
                  {avatarText(user?.username ?? '游客')}
                </Avatar>
                <div>
                  <Typography.Text id="community-composer-title" strong>
                    分享你的游览感受
                  </Typography.Text>
                  <Typography.Text type="secondary" className={styles.identityName}>
                    以 {user?.username ?? '游客'} 的身份发布
                  </Typography.Text>
                </div>
              </div>

              <Input.TextArea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="例如：哪个景点最值得停留，什么时候游览更舒服……"
                maxLength={500}
                autoSize={{ minRows: 3, maxRows: 7 }}
                showCount
                aria-label="留言内容"
              />

              <div className={styles.composerActions}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={spotId}
                  options={spotOptions}
                  placeholder="关联景点（可选）"
                  onChange={setSpotId}
                  className={styles.spotSelect}
                  popupClassName={styles.spotDropdown}
                  suffixIcon={<EnvironmentOutlined />}
                  aria-label="关联景点"
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitting}
                  disabled={!content.trim()}
                  onClick={handlePublish}
                >
                  发布留言
                </Button>
              </div>
            </section>

            <section className={styles.feed} aria-label="游客留言">
              <div className={styles.feedToolbar}>
                <Segmented
                  value={view}
                  onChange={handleViewChange}
                  options={[
                    { label: '最新', value: 'latest' },
                    { label: '热门', value: 'popular' },
                    { label: '我的', value: 'mine' },
                  ]}
                />
                <Typography.Text type="secondary">共 {total} 条</Typography.Text>
              </div>

              {error ? (
                <Alert
                  type="warning"
                  showIcon
                  message="留言加载失败"
                  description={error}
                  action={<Button onClick={loadPosts}>重试</Button>}
                  className={styles.alert}
                />
              ) : null}

              {loading ? (
                <div className={styles.loadingList} aria-label="正在加载留言">
                  {[0, 1, 2].map((item) => (
                    <div className={styles.skeletonRow} key={item}>
                      <Skeleton.Avatar active size="large" />
                      <Skeleton active title paragraph={{ rows: 2 }} />
                    </div>
                  ))}
                </div>
              ) : posts.length ? (
                <div className={styles.postList}>
                  {posts.map((post) => (
                    <article className={styles.post} key={post.id}>
                      <Avatar
                        size={42}
                        className={styles.avatar}
                        style={{ backgroundColor: avatarColor(post.authorName) }}
                      >
                        {avatarText(post.authorName)}
                      </Avatar>
                      <div className={styles.postBody}>
                        <div className={styles.postHeader}>
                          <Space size={8} wrap>
                            <Typography.Text strong>{post.authorName}</Typography.Text>
                            {post.isMine ? <Tag>我的留言</Tag> : null}
                            {post.status === 'hidden' ? <Tag color="warning">已隐藏</Tag> : null}
                          </Space>
                          <time className={styles.time} dateTime={post.createdAt}>
                            {formatCommunityTime(post.createdAt)}
                          </time>
                        </div>

                        <Typography.Paragraph className={styles.content}>
                          {post.content}
                        </Typography.Paragraph>

                        <div className={styles.postFooter}>
                          <div>
                            {post.spot ? (
                              <Link
                                to={`/spots/${encodeURIComponent(post.spot.id)}`}
                                className={styles.spotLink}
                              >
                                <EnvironmentOutlined />
                                {post.spot.name}
                              </Link>
                            ) : (
                              <Typography.Text type="secondary">游览随记</Typography.Text>
                            )}
                          </div>
                          <Space size={4}>
                            <Tooltip title={post.likedByMe ? '取消点赞' : '点赞'}>
                              <Button
                                type="text"
                                className={post.likedByMe ? styles.likedButton : styles.likeButton}
                                icon={post.likedByMe ? <LikeFilled /> : <LikeOutlined />}
                                loading={pendingLikes.has(post.id)}
                                disabled={post.status !== 'published'}
                                onClick={() => handleLike(post)}
                                aria-label={`${post.likedByMe ? '取消点赞' : '点赞'}，当前 ${post.likeCount} 个赞`}
                              >
                                {post.likeCount}
                              </Button>
                            </Tooltip>
                            {post.isMine ? (
                              <Popconfirm
                                title="删除这条留言？"
                                description="删除后，其他游客将无法再看到它。"
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                onConfirm={() => handleDelete(post.id)}
                              >
                                <Tooltip title="删除留言">
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={deletingId === post.id}
                                    aria-label="删除留言"
                                  />
                                </Tooltip>
                              </Popconfirm>
                            ) : null}
                          </Space>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={view === 'mine' ? '你还没有发布过留言' : '暂时还没有游客留言'}
                  className={styles.empty}
                >
                  {view === 'mine' ? (
                    <Button onClick={() => handleViewChange('latest')}>看看大家在聊什么</Button>
                  ) : null}
                </Empty>
              )}

              {total > PAGE_SIZE ? (
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  onChange={setPage}
                  className={styles.pagination}
                />
              ) : null}
            </section>
          </main>

          <aside className={styles.aside}>
            <section className={styles.asideSection}>
              <div className={styles.asideTitle}>
                <CommentOutlined />
                社区公约
              </div>
              <ul className={styles.rules}>
                <li>分享真实、具体的游览体验</li>
                <li>尊重其他游客的不同感受</li>
                <li>不要发布联系方式或广告信息</li>
              </ul>
            </section>
            <section className={styles.asideSection}>
              <Typography.Text type="secondary">当前发言身份</Typography.Text>
              <div className={styles.currentUser}>
                <Avatar
                  size={34}
                  style={{ backgroundColor: avatarColor(user?.username ?? '') }}
                >
                  {avatarText(user?.username ?? '游客')}
                </Avatar>
                <Typography.Text strong>{user?.username ?? '游客'}</Typography.Text>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </ConfigProvider>
  );
}

function avatarText(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '游';
}

function avatarColor(name: string) {
  const code = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return avatarColors[code % avatarColors.length];
}

function formatCommunityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
