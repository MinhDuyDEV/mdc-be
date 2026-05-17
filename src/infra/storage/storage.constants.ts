export const STORAGE_CLIENT = Symbol('STORAGE_CLIENT');
export type StorageClient = import('@aws-sdk/client-s3').S3Client;
