"use client";

import React from "react";

export default function H5PFrame({
  id,
  height = 640,
}: {
  id: string;
  height?: number;
}) {
  return (
    <iframe
      title={`H5P: ${id}`}
      src={`/h5p-embed.html?id=${encodeURIComponent(id)}`}
      style={{
        width: "100%",
        height,
        border: "1px solid rgba(15,23,42,.14)",
        borderRadius: 16,
        background: "white",
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
