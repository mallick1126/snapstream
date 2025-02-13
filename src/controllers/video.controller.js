import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${
      remainingSeconds < 10 ? "0" : ""
    }${remainingSeconds}`;
  } else {
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }
}

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortType },
  };

  if (query) {
    options.query = { title: { $regex: query, $options: "i" } };
  }
  const videos = await Video.aggregatePaginate(options);
  return new ApiResponse(res).success(videos);
});

const publishAVideo = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  const videoLocalPath = req.files?.videoFile[0].path;
  const thumbnailLocalPath = req.files?.thumbnail[0].path;
  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(409, "Video file is required!");
  }

  const videoFile = await uploadOnCloudinary(videoLocalPath, "videoFile");
  const thumbnailFile = await uploadOnCloudinary(
    thumbnailLocalPath,
    "thumbnail"
  );
  const actualDuration = formatDuration(videoFile.duration);

  const newVideo = await Video.create({
    title,
    description,
    videoFile: videoFile.url,
    thumbnail: thumbnailFile.url,
    duration: actualDuration,
    user: userId,
  });

  const uploadedVideo = await Video.findById(newVideo._id);
  if (!uploadedVideo) {
    throw new ApiError(500, "Something went wrong while uploading the video.");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, { uploadedVideo }, "Video Published Successfully!")
    );
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video Retrieved successfully!"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  const userId = req.user?._id;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "No video found.");
  }
  if (userId.toString() !== video.owner.toString()) {
    throw new ApiError(400, "You are not authorized");
  }

  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  let thumbnailUrl = video.thumbnail;
  if (thumbnailLocalPath) {
    const uploadedThumbnail = await uploadOnCloudinary(
      thumbnailLocalPath,
      "thumbnails"
    );
    if (video.thumbnail) {
      await deleteFromCloudinary(video.thumbnail, "thumbnails");
    }
    thumbnailUrl = uploadedThumbnail.url;
  }

  video.title = title;
  video.description = description;
  video.thumbnail = thumbnailUrl;
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated Successfully!"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  const userId = req.user?._id;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "No video found.");
  }
  if (userId.toString() !== video.owner.toString()) {
    throw new ApiError(400, "You are not authorized");
  }

  await Video.deleteOne({ _id: videoId });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  video.isPublished = !video.isPublished;
  await video.save();
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video status updated successfully"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
