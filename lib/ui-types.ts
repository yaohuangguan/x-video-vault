export type TagSummary = { id: number; name: string };

export type VaultItem = {
  postId: string;
  text: string;
  createdAt: string | null;
  firstSyncedAt?: string;
  lastSyncedAt?: string;
  originalUrl: string;
  importSource: string;
  isFavorite: boolean;
  unavailable?: boolean;
  author: {
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  } | null;
  media: {
    mediaKey: string;
    type: string;
    previewImageUrl?: string | null;
    unavailable?: boolean;
  };
  tags: TagSummary[];
};

export type AuthState = {
  state: "setup" | "login";
  authenticated: boolean;
};

export type LibraryResponse = {
  auth: AuthState;
  items: VaultItem[];
  total: number;
  tags: TagSummary[];
  lastImport: string | null;
  hasMore: boolean;
};
