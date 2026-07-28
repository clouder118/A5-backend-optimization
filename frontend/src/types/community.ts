export type CommunityPostStatus = 'published' | 'hidden' | 'deleted';
export type CommunityPostScope = 'all' | 'mine';
export type CommunityPostSort = 'latest' | 'popular';

export interface CommunityPost {
  id: number;
  authorId: string;
  authorName: string;
  content: string;
  spot: {
    id: string;
    name: string;
  } | null;
  status: CommunityPostStatus;
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPostList {
  items: CommunityPost[];
  total: number;
  page: number;
  pageSize: number;
}
