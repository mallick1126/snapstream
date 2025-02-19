import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUserS3,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserCoverImageS3,
  getUserChannelProfile,
  getWatchHistory,
  updateAccountDetails,
  updateUserAvatarS3,
} from "../controllers/user.controller.js";
import { imageUpload, videoUpload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  imageUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUserS3
);

router.route("/login").post(loginUser);

//secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

router
  .route("/updateAvatar")
  .post(verifyJWT, imageUpload.single("avatar"), updateUserAvatarS3);

router
  .route("/updateCoverImage")
  .post(verifyJWT, imageUpload.single("coverImage"), updateUserCoverImageS3);

router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
