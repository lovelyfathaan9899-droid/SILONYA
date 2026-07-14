import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Skeleton } from "./Skeleton";

export interface DataTableColumn<T> {
  key: keyof T & string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Overrides the React key for this column definition — required when more than one column reads/derives from the same underlying field (e.g. two columns both keyed off "id"). Defaults to `key`. */
  id?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * The shared list-view pattern every admin data table uses (ADMIN_PANEL.md
 * §5 — "consistent column sorting, filtering, and cursor pagination
 * behavior across every list view"). This primitive owns only the table
 * markup/accessibility; sorting, filtering, and pagination controls are
 * composed around it by the page that uses it (PROJECT_RULES.md §1 — no
 * business logic in a Primitive-tier component).
 */
export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  isLoading = false,
  emptyState,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("border-mist overflow-x-auto border", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-mist border-b">
            {columns.map((column) => (
              <th
                key={column.id ?? column.key}
                scope="col"
                className="text-stone px-4 py-3 font-sans text-xs uppercase tracking-wide"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={`skeleton-row-${String(rowIndex)}`} className="border-mist border-b">
                {columns.map((column) => (
                  <td key={column.id ?? column.key} className="px-4 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12">
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={
                  onRowClick
                    ? () => {
                        onRowClick(row);
                      }
                    : undefined
                }
                className={cn(
                  "border-mist text-ink border-b font-sans text-sm last:border-b-0",
                  onRowClick && "hover:bg-bone cursor-pointer transition-colors duration-150",
                )}
              >
                {columns.map((column) => (
                  <td key={column.id ?? column.key} className={cn("px-4 py-4", column.className)}>
                    {column.render ? column.render(row) : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
