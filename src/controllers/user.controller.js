import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { uploadObjectToS3, deleteObjectFromS3 } from "../utils/s3.config.js";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

/*const registerUserCloudinary = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console;

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath, "snapstream/avatars");
  const coverImage = await uploadOnCloudinary(coverImageLocalPath, "snapstream/cover-images");

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});*/

const registerUserS3 = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const fileUrls = {
    avatar: "",
    coverImage: "",
  };

  try {
    if (req.files?.avatar?.[0]) {
      const avatarUpload = await uploadObjectToS3(
        `avatar/${Date.now()}-${req.files.avatar[0].originalname}`,
        req.files.avatar[0].buffer,
        req.files.avatar[0].mimetype
      );
      fileUrls.avatar = avatarUpload.Location;
    }

    if (req.files?.coverImage?.[0]) {
      const coverUpload = await uploadObjectToS3(
        `coverImage/${Date.now()}-${req.files.coverImage[0].originalname}`,
        req.files.coverImage[0].buffer,
        req.files.coverImage[0].mimetype
      );
      fileUrls.coverImage = coverUpload.Location;
    }
  } catch (error) {
    console.error("File Upload Error:", error);
    throw new ApiError(400, "Error while uploading files to S3");
  }

  const user = await User.create({
    fullname: fullname,
    email: email,
    username: username,
    password: password,
    avatar: fileUrls.avatar,
    coverImage: fileUrls.coverImage,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// const updateUserAvatar = asyncHandler(async (req, res) => {
//   const avatarLocalPath = req.file?.path;

//   if (!avatarLocalPath) {
//     throw new ApiError(400, "Avatar file is missing");
//   }

//   const user = await User.findById(req.user?._id);
//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//   const oldAvatar = user.avatar;

//   try {
//     //delete old image
//     if (oldAvatar) {
//       deleteFromCloudinary(oldAvatar);
//     }
//     //upload new image
//     const avatar = await uploadOnCloudinary(
//       avatarLocalPath,
//       "snapstream/avatars"
//     );
//     if (!avatar.url) {
//       throw new ApiError(400, "Error while uploading on avatar");
//     }

//     //update user avatar
//     user.avatar = avatar.url;
//     await user.save({ validateBeforeSave: false });

//     return res
//       .status(200)
//       .json(new ApiResponse(200, user, "Avatar image updated successfully"));
//   } catch (error) {
//     console.error(error);
//     //Rollback
//     if (oldAvatar) {
//       await uploadOnCloudinary(oldAvatar);
//     }

//     throw new ApiError(400, "Error while updating avatar");
//   }
// });

const updateUserAvatarS3 = asyncHandler(async (req, res) => {
  const avatar = req.file;
  if (!avatar) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const oldAvatar = user.avatar;
  let newAvatarUrl = "";

  try {
    const avatarUpload = await uploadObjectToS3(
      `avatar/${Date.now()}-${avatar.originalname}`,
      avatar.buffer,
      avatar.mimetype
    );

    if (!avatarUpload.Location) {
      throw new ApiError(500, "Failed to upload avatar to S3");
    }

    newAvatarUrl = avatarUpload.Location;
    user.avatar = newAvatarUrl;
    await user.save({ validateBeforeSave: false });

    if (oldAvatar) {
      const oldAvatarKey = oldAvatar.split("/").slice(-1)[0];
      await deleteObjectFromS3(`avatar/${oldAvatarKey}`);
    }

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Avatar image updated successfully"));
  } catch (error) {
    console.error("Avatar Update Error:", error);
    if (newAvatarUrl) {
      const newAvatarKey = newAvatarUrl.split("/").slice(-1)[0];
      await deleteObjectFromS3(`avatar/${newAvatarKey}`);
    }
    throw new ApiError(500, "Error while updating avatar");
  }
});

// const updateUserCoverImage = asyncHandler(async (req, res) => {
//   const coverImageLocalPath = req.file?.path;

//   if (!coverImageLocalPath) {
//     throw new ApiError(400, "Cover image file is missing");
//   }

//   const user = await User.findById(req.user?._id);
//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }
//   const oldCoverImage = user.coverImage;
//   try {
//     //delete old image
//     if (oldCoverImage) {
//       deleteFromCloudinary(oldCoverImage);
//     }
//     const coverImage = await uploadOnCloudinary(
//       coverImageLocalPath,
//       "snapstream/cover-images"
//     );
//     if (!coverImage.url) {
//       throw new ApiError(400, "Error while uploading on avatar");
//     }

//     //update user avatar
//     user.coverImage = coverImage.url;
//     await user.save({ validateBeforeSave: false });

//     return res
//       .status(200)
//       .json(new ApiResponse(200, user, "Cover image updated successfully"));
//   } catch (error) {
//     console.error(error);
//     //Rollback
//     if (oldCoverImage) {
//       await uploadOnCloudinary(oldCoverImage);
//     }

//     throw new ApiError(400, "Error while updating cover image");
//   }
// });

const updateUserCoverImageS3 = asyncHandler(async (req, res) => {
  const coverImage = req.file;

  if (!coverImage) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const oldCoverImage = user.coverImage;
  let newCoverImageUrl = "";
  try {
    const coverImageUpload = await uploadObjectToS3(
      `coverImage/${Date.now()}-${coverImage.originalname}`,
      coverImage.buffer,
      coverImage.mimetype
    );

    if (!coverImageUpload.Location) {
      throw new ApiError(500, "Failed to upload cover image to S3");
    }

    newCoverImageUrl = coverImageUpload.Location;
    user.coverImage = newCoverImageUrl;
    await user.save({ validateBeforeSave: false });

    if (oldCoverImage) {
      const oldCoverImageKey = oldCoverImage.split("/").slice(-1)[0];
      await deleteObjectFromS3(`coverImage/${oldCoverImageKey}`);
    }
    return res
      .status(200)
      .json(new ApiResponse(200, user, "Cover image updated successfully"));
  } catch (error) {
    console.error(error);
    //Rollback
    if (newCoverImageUrl) {
      const newCoverImageKey = newCoverImageUrl.split("/").slice(-1)[0];
      await deleteObjectFromS3(`coverImage/${newCoverImageKey}`);
    }
    throw new ApiError(400, "Error while updating cover image");
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: { $regex: new RegExp(`^${username}$`, "i") },
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $anyElementTrue: {
            $map: {
              input: "$subscribers",
              as: "sub",
              in: { $eq: ["$$sub.subscriber", req.user?._id] },
            },
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          { $sort: { updatedAt: -1 } },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory || [],
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUserS3,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatarS3,
  updateUserCoverImageS3,
  getUserChannelProfile,
  getWatchHistory,
};
