"use client";

import { useParams } from "next/navigation";
import { OrderDetail } from "./OrderDetail";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <OrderDetail orderId={params.id} />;
}
