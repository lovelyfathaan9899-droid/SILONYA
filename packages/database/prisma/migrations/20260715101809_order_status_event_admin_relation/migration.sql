-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
