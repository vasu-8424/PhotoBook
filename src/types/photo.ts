export type PhotoOrientation =
  | "PORTRAIT"
  | "LANDSCAPE"
  | "SQUARE";

export interface PhotoAsset {
  id: string;

  filename: string;

  mimeType: string;

  width: number;
  height: number;

  fileSizeBytes: number;

  aspectRatio: number;

  orientation: PhotoOrientation;

  storagePath: string;

  thumbnailPath?: string;

  createdAt: string;
}
