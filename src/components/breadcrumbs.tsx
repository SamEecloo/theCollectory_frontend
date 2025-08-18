// src/components/Breadcrumbs.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, matchPath, useLocation, useParams } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import api from "@/lib/api";

// Map static routes to labels; dynamic routes can use a loader function
const routes = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/collections", label: "Dashboard" },
  { path: "/collections/new", label: "New Collection" },
  { path: "/collections/:collectionId", label: async (p: any) => {
      // Try fetching the collection name
      const res = await api.get(`/collections/${p.collectionId}`);
      return res.data?.name || "Collection";
    }
  },
  { path: "/collections/:collectionId/edit", label: "Edit" },
  { path: "/collections/:collectionId/add-item", label: "Add Item" },
];

export function Breadcrumbs() {
  const location = useLocation();
  const params = useParams();
  const [labels, setLabels] = useState<Record<string,string>>({});

  const segments = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    let acc = "";
    return parts.map((seg) => {
      acc += `/${seg}`;
      return acc;
    });
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const newLabels: Record<string,string> = {};
      for (const seg of segments) {
        const match = routes.find(r => matchPath({ path: r.path, end: true }, seg));
        if (!match) continue;
        if (typeof match.label === "function") {
          const l = await match.label(params);
          if (!cancelled) newLabels[seg] = l;
        } else {
          newLabels[seg] = match.label;
        }
      }
      if (!cancelled) setLabels(newLabels);
    })();
    return () => { cancelled = true; };
  }, [segments, params]);

  if (!segments.length) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const text =
            labels[seg] ??
            decodeURIComponent(seg.split("/").pop() || "").replace(/-/g, " ");
          return (
            <span key={seg} className="flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <span className="text-muted-foreground">{text}</span>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={seg}>{text}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
