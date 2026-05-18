export interface ApiRequest {
  method?: string;
  url?: string;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
  send: (body: string | Buffer) => void;
  end: () => void;
  setHeader: (name: string, value: string | string[]) => void;
}
