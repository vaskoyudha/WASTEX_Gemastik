import React from "react";
import { Redirect } from "expo-router";

export default function ScanTabPlaceholder() {
  return <Redirect href="/scan/upload" />;
}
