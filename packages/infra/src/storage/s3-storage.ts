import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  assertSafeKey,
  type ObjectStorage,
  type PresignedUpload,
  type PresignOptions,
} from './types.js';

export interface S3StorageOptions {
  endpoint?: string | undefined;
  region: string;
  bucket: string;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  /** آدرس عمومی (معمولاً CDN) که فایل‌ها از آن خوانده می‌شوند */
  publicUrl?: string | undefined;
}

export class S3Storage implements ObjectStorage {
  readonly kind = 's3' as const;
  private readonly client: S3Client;
  private readonly publicBase: string;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
    });
    this.publicBase =
      options.publicUrl ??
      (options.endpoint
        ? `${options.endpoint}/${options.bucket}`
        : `https://${options.bucket}.s3.${options.region}.amazonaws.com`);
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    assertSafeKey(key);
    return `${this.publicBase}/${key}`;
  }

  /** POST policy تا حجم و نوع فایل سمت S3 اجباری باشد (PUT ساده این کنترل را ندارد) */
  async presignUpload(key: string, options: PresignOptions): Promise<PresignedUpload> {
    assertSafeKey(key);
    const expires = options.expiresInSeconds ?? 600;
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.options.bucket,
      Key: key,
      Expires: expires,
      Fields: { 'Content-Type': options.contentType },
      Conditions: [
        ['content-length-range', 1, options.maxBytes],
        ['eq', '$Content-Type', options.contentType],
      ],
    });
    return {
      method: 'POST',
      url,
      fields,
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
