/// <reference types="nativewind/types" />

declare module "*.css";

declare module "*.bundle" {
  const assetId: number;
  export default assetId;
}
