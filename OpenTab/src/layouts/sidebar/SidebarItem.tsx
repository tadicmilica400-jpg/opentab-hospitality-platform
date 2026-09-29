import { Link, useLocation } from "react-router-dom";
import type { SidebarItemConfig } from "./ownerSidebarItems";

type SidebarItemProps = {
  item: SidebarItemConfig;
  onClick?: () => void;
  isActive?: boolean;
  itemRef?: (element: HTMLElement | null) => void;
};

function getTargetParts(path: string) {
  const [pathname, search = ""] = path.split("?");

  return {
    pathname,
    search: search ? `?${search}` : "",
  };
}

export function SidebarItem({ item, onClick, isActive, itemRef }: SidebarItemProps) {
  const location = useLocation();

  const fallbackActive = item.path
    ? (() => {
        const target = getTargetParts(item.path);
        return location.pathname === target.pathname && location.search === target.search;
      })()
    : false;

  const active = isActive ?? fallbackActive;
  const className = `nav-item ${active ? "active" : ""} ${item.danger ? "danger" : ""}`;

  const content = (
    <>
      <span className="nav-item__icon">{item.icon}</span>
      <span className="nav-item__label">{item.label}</span>
      {item.badge ? <span className="nav-item__badge">{item.badge}</span> : null}
    </>
  );

  if (!item.path) {
    return (
      <button type="button" ref={itemRef} className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <Link to={item.path} ref={itemRef} className={className}>
      {content}
    </Link>
  );
}
