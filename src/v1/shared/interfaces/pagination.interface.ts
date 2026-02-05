export interface PaginationResult<T> {
  status: 'success' | 'error';
  message: string;
  data?: T[] | null;
  page?: number;
  limit?: number;
  total?: number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  filter?: any;
}
