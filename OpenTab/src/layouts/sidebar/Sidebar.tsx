import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { SidebarItem } from "./SidebarItem";
import { GlassBadge } from "../../shared/ui/GlassBadge";
import type { SidebarItemConfig, SidebarSectionConfig } from "./ownerSidebarItems";

type SidebarProps = {
  roleLabel: string;
  profile: {
    initials: string;
    name: string;
    meta: string;
  };
  sections: SidebarSectionConfig[];
  onCategoryClick?: () => void;
  onLogout?: () => void;
  useGlassRoleBadge?: boolean;
  notificationsSlot?: ReactNode;
};

type SidebarGhostStyle = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SidebarSmear = {
  tick: number;
  direction: "up" | "down";
  magnitude: number;
};

function getTargetParts(path: string) {
  const [pathname, search = ""] = path.split("?");

  return {
    pathname,
    search: search ? `?${search}` : "",
  };
}

function getItemKey(item: SidebarItemConfig) {
  return item.path ?? item.label;
}

function getActiveItem(items: SidebarItemConfig[], pathname: string, search: string) {
  const exactWithSearch = items.find((item) => item.path === `${pathname}${search}`);

  if (exactWithSearch) {
    return exactWithSearch;
  }

  const exactPath = items.find((item) => {
    if (!item.path) {
      return false;
    }

    const target = getTargetParts(item.path);
    return !target.search && target.pathname === pathname;
  });

  if (exactPath) {
    return exactPath;
  }

  return items
    .filter((item) => {
      if (!item.path) {
        return false;
      }

      const target = getTargetParts(item.path);
      return !target.search && pathname.startsWith(`${target.pathname}/`);
    })
    .sort((first, second) => {
      const firstPath = getTargetParts(first.path ?? "").pathname;
      const secondPath = getTargetParts(second.path ?? "").pathname;
      return secondPath.length - firstPath.length;
    })[0];
}

export function Sidebar({
  roleLabel,
  profile,
  sections,
  onCategoryClick,
  onLogout,
  useGlassRoleBadge = false,
  notificationsSlot,
}: SidebarProps) {
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const previousActiveIndexRef = useRef<number | null>(null);
  const [ghostStyle, setGhostStyle] = useState<SidebarGhostStyle | null>(null);
  const [smear, setSmear] = useState<SidebarSmear>({
    tick: 0,
    direction: "down",
    magnitude: 1,
  });

  const navItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  const activeItem = useMemo(
    () => getActiveItem(navItems, location.pathname, location.search),
    [location.pathname, location.search, navItems],
  );

  const activeKey = activeItem ? getItemKey(activeItem) : null;
  const activeIndex = activeItem
    ? navItems.findIndex((item) => getItemKey(item) === activeKey)
    : -1;

  const registerItemRef = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      itemRefs.current[key] = element;
    },
    [],
  );

  const updateGhostPosition = useCallback(() => {
    if (!activeKey) {
      setGhostStyle(null);
      return;
    }

    const navElement = navRef.current;
    const activeElement = itemRefs.current[activeKey];

    if (!navElement || !activeElement) {
      setGhostStyle(null);
      return;
    }

    const activeRect = activeElement.getBoundingClientRect();
    const navRect = navElement.getBoundingClientRect();

    setGhostStyle({
      top: activeRect.top - navRect.top + navElement.scrollTop,
      left: activeRect.left - navRect.left + navElement.scrollLeft,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, [activeKey]);

  useLayoutEffect(() => {
    updateGhostPosition();
  }, [updateGhostPosition, sections]);

  useLayoutEffect(() => {
    if (activeIndex < 0) {
      previousActiveIndexRef.current = null;
      return;
    }

    const previousIndex = previousActiveIndexRef.current;

    if (previousIndex !== null && previousIndex !== activeIndex) {
      const distance = Math.max(1, Math.min(Math.abs(activeIndex - previousIndex), 4));

      setSmear((current) => ({
        tick: current.tick + 1,
        direction: activeIndex > previousIndex ? "down" : "up",
        magnitude: distance,
      }));
    }

    previousActiveIndexRef.current = activeIndex;
  }, [activeIndex]);

  useLayoutEffect(() => {
    const navElement = navRef.current;

    if (!navElement) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateGhostPosition);
    resizeObserver.observe(navElement);

    Object.values(itemRefs.current).forEach((element) => {
      if (element) {
        resizeObserver.observe(element);
      }
    });

    window.addEventListener("resize", updateGhostPosition);
    navElement.addEventListener("scroll", updateGhostPosition, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateGhostPosition);
      navElement.removeEventListener("scroll", updateGhostPosition);
    };
  }, [activeKey, updateGhostPosition, sections]);

  return (
    <aside className="app-sidebar">
      <div className="sidebar">
        <div className="sidebar__accent-top" />

        <div className="sidebar__header">
          <div className="sidebar__brand">
            Open<span>Tab</span>
          </div>
          {useGlassRoleBadge ? (
            <GlassBadge tone="gold">{roleLabel}</GlassBadge>
          ) : (
            <span className="sidebar__role-badge">{roleLabel}</span>
          )}
        </div>

        <div className="divider-elegant" />

        <div className="sidebar__profile">
          <div className="profile__avatar">{profile.initials}</div>
          <div className="profile__info">
            <div className="profile__name">{profile.name}</div>
            <div className="profile__meta">{profile.meta}</div>
          </div>
          <div className="profile__status" />
        </div>

        {notificationsSlot ? <div className="sidebar__notifications">{notificationsSlot}</div> : null}

        <div className="divider-elegant" />

        <nav ref={navRef} className="sidebar__nav">
          {ghostStyle ? (
            <div
              className="sidebar-nav-ghost"
              style={{
                top: ghostStyle.top + 4,
                left: ghostStyle.left,
                width: ghostStyle.width,
                height: ghostStyle.height - 8,
              }}
            >
              <div
                key={`burst-${smear.tick}`}
                className={`sidebar-nav-ghost__burst ${smear.direction}`}
                style={{ "--sidebar-smear": smear.magnitude } as CSSProperties}
              />
              <div
                key={`optical-${smear.tick}`}
                className={`sidebar-nav-ghost__optical ${smear.direction}`}
                style={{ "--sidebar-smear": smear.magnitude } as CSSProperties}
              />
              <div className="sidebar-nav-ghost__shine" />
              <div className="sidebar-nav-ghost__accent" />
            </div>
          ) : null}

          {sections.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section__label">{section.label}</div>

              {section.items.map((item) => {
                const key = getItemKey(item);

                return (
                  <SidebarItem
                    key={key}
                    item={item}
                    isActive={key === activeKey}
                    itemRef={registerItemRef(key)}
                    onClick={item.label === "Kategorije" ? onCategoryClick : undefined}
                  />
                );
              })}

              <div className="divider-elegant !mt-3 !mb-1.5" />
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="divider-elegant mb-3.5" />
          <SidebarItem
            item={{
              label: "Odjava",
              icon: "→",
              danger: true,
            }}
            onClick={onLogout}
          />
        </div>
      </div>
    </aside>
  );
}
