"use client";

import { useParams } from "next/navigation";
import { ProductEditor } from "./ProductEditor";

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();
  return <ProductEditor productId={params.id} />;
}
