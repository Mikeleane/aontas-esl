"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function H5PSinglePage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id || "").toString();
  const [height, setHeight] = useState(900);

  const src = useMemo(() => {
    if (!id) return "";
    return `/h5p/_player/h5p-embed.html?id=${encodeURIComponent(id)}`;
  }, [id]);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontWeight: 1100, fontSize: 20 }}>H5P: {id}</div>

      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 900 }}>
          Height: {height}px
          <input
            type="range"
            min={400}
            max={1600}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <iframe
          title={`H5P ${id}`}
          src={src}
          style={{
            width: "100%",
            height,
            border: "1px solid rgba(15,23,42,.14)",
            borderRadius: 18,
            background: "white",
          }}
        />
      </div>
    </div>
  );
}
