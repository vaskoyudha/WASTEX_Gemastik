import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { Platform, Share as SystemShare } from "react-native";

import type { SellingKit } from "./types";

export class InstagramShareConfigurationError extends Error {}
export class NativeInstagramShareUnavailableError extends Error {}

export function buildSocialCaption(kit: SellingKit): string {
  return [
    kit.productName,
    kit.description,
    kit.captions[0],
    (kit.hashtags ?? []).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function localImageUri(imageUrl: string, target: "story" | "feed" | "share") {
  if (/^(file|content|data):/.test(imageUrl)) return imageUrl;
  const destination = new File(Paths.cache, `wastex-${target}-${Date.now()}.png`);
  const downloaded = await File.downloadFileAsync(imageUrl, destination, { idempotent: true });
  return downloaded.uri;
}

async function nativeShareModule() {
  try {
    return require("react-native-share") as typeof import("react-native-share");
  } catch {
    throw new NativeInstagramShareUnavailableError(
      "Native Instagram sharing requires a development or production build.",
    );
  }
}

export async function shareToInstagramStory(
  imageUrl: string,
  caption: string,
  metaAppId: string | undefined,
) {
  await Clipboard.setStringAsync(caption);
  if (Platform.OS === "web") {
    await SystemShare.share({ message: `${caption}\n\n${imageUrl}`, url: imageUrl });
    return;
  }
  if (!metaAppId?.trim()) {
    throw new InstagramShareConfigurationError("EXPO_PUBLIC_META_APP_ID is not configured.");
  }

  const image = await localImageUri(imageUrl, "story");
  const { default: NativeShare, Social } = await nativeShareModule();
  await NativeShare.shareSingle({
    social: Social.InstagramStories,
    appId: metaAppId.trim(),
    backgroundImage: image,
    backgroundTopColor: "#F8F3E7",
    backgroundBottomColor: "#166534",
  });
}

export async function shareToInstagramFeed(imageUrl: string, caption: string) {
  await Clipboard.setStringAsync(caption);
  if (Platform.OS === "web") {
    await SystemShare.share({ message: `${caption}\n\n${imageUrl}`, url: imageUrl });
    return;
  }

  const image = await localImageUri(imageUrl, "feed");
  const { default: NativeShare, Social } = await nativeShareModule();
  await NativeShare.shareSingle({
    social: Social.Instagram,
    url: image,
    type: "image/png",
    message: caption,
    forceDialog: true,
    useInternalStorage: true,
  });
}

export async function shareToOtherApps(imageUrl: string, caption: string) {
  if (Platform.OS === "web") {
    await SystemShare.share({ message: `${caption}\n\n${imageUrl}`, url: imageUrl });
    return;
  }

  try {
    const image = await localImageUri(imageUrl, "share");
    const { default: NativeShare } = await nativeShareModule();
    await NativeShare.open({
      url: image,
      type: "image/png",
      message: caption,
      failOnCancel: false,
      useInternalStorage: true,
    });
  } catch (error) {
    if (error instanceof NativeInstagramShareUnavailableError) {
      await SystemShare.share({ message: `${caption}\n\n${imageUrl}`, url: imageUrl });
      return;
    }
    throw error;
  }
}

export function isShareCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("cancel") || message.includes("dismiss") || message.includes("did not share");
}
