import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Initialize S3 Client
const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Get a Signed URL for an object in S3 (Temporary Access)
 */
export const getObjectUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    // Generate a signed URL (valid for 'expiresIn' seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return signedUrl;
  } catch (error) {
    console.error("S3 Get Signed URL Error:", error);
    throw new Error("Failed to generate signed URL for S3 file");
  }
};

/**
 * Upload an Object to S3 and return its public URL
 */
export const uploadObjectToS3 = async (
  key,
  body,
  contentType = "application/octet-stream"
) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    return {
      Location: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

/**
 * Delete an Object from S3
 */
export const deleteObjectFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    return { message: `File ${key} deleted successfully` };
  } catch (error) {
    console.error("S3 Delete Error:", error);
    throw new Error(`Failed to delete file ${key} from S3`);
  }
};
