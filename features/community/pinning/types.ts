export type AdminPinnedPostItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  authorName: string;
  pinned: boolean;
  pinnedAt: string | null;
};

export type AdminPinnedPostsData = {
  pinnedPosts: AdminPinnedPostItem[];
  publishedPosts: AdminPinnedPostItem[];
  maximumPins: number;
  unavailable?: boolean;
};
