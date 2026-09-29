// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useState } from "react";
import type {
  ActionResult,
  RoleMutationValues,
  StaffFormValues,
  StaffMember,
  StaffRole,
  StaffRoleFilter,
  StaffStatusFilter,
} from "../../../../entities/staff/staff.types";
import {
  activateStaffMember,
  createStaffMember,
  createStaffRole,
  deactivateStaffMember,
  deleteStaffMember,
  deleteStaffRole,
  getStaffMembers,
  getStaffRoles,
  updateStaffMember,
  updateStaffRole,
} from "../api/staffApi";
import { notifyOwnerSidebarChanged } from "../../../../layouts/sidebar/ownerSidebarApi";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Došlo je do greške pri komunikaciji sa bazom.";
}

function getFallbackRoleIcon(role: string) {
  if (role.toLowerCase().includes("menad")) return "♛";
  if (role.toLowerCase().includes("šank")) return "◈";
  if (role.toLowerCase().includes("konobar")) return "◎";
  return "◇";
}

function buildRoleIcons(roles: StaffRole[], apiIcons: Record<string, string>) {
  return roles.reduce<Record<string, string>>((icons, role) => {
    icons[role] = apiIcons[role] || getFallbackRoleIcon(role);
    return icons;
  }, {});
}

export function useStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [roleIcons, setRoleIcons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>("all");

  const applyRoles = (roleNames: StaffRole[], apiIcons: Record<string, string>) => {
    const normalizedRoles = roleNames.length > 0 ? roleNames : ["Konobar"];
    setRoles(normalizedRoles);
    setRoleIcons(buildRoleIcons(normalizedRoles, apiIcons));
  };

  const loadStaff = async () => {
    const [staffResponse, rolesResponse] = await Promise.all([getStaffMembers(), getStaffRoles()]);
    const roleNames = rolesResponse.role_names?.length
      ? rolesResponse.role_names
      : Array.from(new Set(staffResponse.map((worker) => worker.role))).filter(Boolean);

    setStaff(staffResponse);
    applyRoles(roleNames, rolesResponse.role_icons ?? {});
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialStaff() {
      try {
        setIsLoading(true);
        setError(null);
        const [staffResponse, rolesResponse] = await Promise.all([getStaffMembers(), getStaffRoles()]);

        if (cancelled) {
          return;
        }

        const roleNames = rolesResponse.role_names?.length
          ? rolesResponse.role_names
          : Array.from(new Set(staffResponse.map((worker) => worker.role))).filter(Boolean);

        setStaff(staffResponse);
        applyRoles(roleNames, rolesResponse.role_icons ?? {});
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return staff
      .filter((worker) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          worker.fullName.toLowerCase().includes(normalizedSearch) ||
          worker.username.toLowerCase().includes(normalizedSearch);

        const matchesRole = roleFilter === "all" || worker.role === roleFilter;
        const matchesStatus = statusFilter === "all" || worker.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((firstWorker, secondWorker) => {
        if (firstWorker.status !== secondWorker.status) {
          return firstWorker.status === "active" ? -1 : 1;
        }

        return firstWorker.fullName.localeCompare(secondWorker.fullName, "sr-Latn", {
          sensitivity: "base",
        });
      });
  }, [staff, search, roleFilter, statusFilter]);

  const counters = useMemo(() => {
    const active = staff.filter((worker) => worker.status === "active").length;

    return {
      all: staff.length,
      active,
      inactive: staff.length - active,
    };
  }, [staff]);

  const usernameExists = (username: string, ignoredWorkerId?: string) =>
    staff.some(
      (worker) =>
        worker.id !== ignoredWorkerId &&
        worker.username.toLowerCase() === username.trim().toLowerCase(),
    );

  const roleExists = (roleName: string, ignoredRoleName?: string) => {
    const normalizedRoleName = roleName.trim().toLowerCase();
    const normalizedIgnoredRoleName = ignoredRoleName?.trim().toLowerCase();

    return roles.some(
      (role) =>
        role.trim().toLowerCase() === normalizedRoleName &&
        role.trim().toLowerCase() !== normalizedIgnoredRoleName,
    );
  };

  const createWorker = async (values: StaffFormValues): Promise<ActionResult> => {
    const fullName = normalizeText(values.fullName);
    const username = normalizeText(values.username);
    const password = values.password.trim();

    if (!fullName) return { ok: false, message: "Ime i prezime su obavezni." };
    if (!username) return { ok: false, message: "Korisničko ime je obavezno." };
    if (!password) return { ok: false, message: "Lozinka je obavezna za novog radnika." };
    if (usernameExists(username)) return { ok: false, message: "Ovo korisničko ime je već zauzeto." };

    try {
      const createdWorker = await createStaffMember({
        ...values,
        fullName,
        username,
        password,
        avatarUrl: values.avatarUrl.trim(),
      });

      setStaff((currentStaff) => [createdWorker, ...currentStaff]);
      if (!roles.includes(createdWorker.role)) {
        const nextRoles = [...roles, createdWorker.role];
        applyRoles(nextRoles, roleIcons);
      }

      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (createError) {
      return { ok: false, message: getErrorMessage(createError) };
    }
  };

  const updateWorker = async (workerId: string, values: StaffFormValues): Promise<ActionResult> => {
    const fullName = normalizeText(values.fullName);
    const username = normalizeText(values.username);
    const password = values.password.trim();

    if (!fullName) return { ok: false, message: "Ime i prezime su obavezni." };
    if (!username) return { ok: false, message: "Korisničko ime je obavezno." };
    if (usernameExists(username, workerId)) return { ok: false, message: "Ovo korisničko ime je već zauzeto." };

    try {
      const updatedWorker = await updateStaffMember(workerId, {
        ...values,
        fullName,
        username,
        password,
        avatarUrl: values.avatarUrl.trim(),
      });

      setStaff((currentStaff) =>
        currentStaff.map((worker) => (worker.id === workerId ? updatedWorker : worker)),
      );

      if (!roles.includes(updatedWorker.role)) {
        const nextRoles = [...roles, updatedWorker.role];
        applyRoles(nextRoles, roleIcons);
      }

      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (updateError) {
      return { ok: false, message: getErrorMessage(updateError) };
    }
  };

  const activateWorker = async (workerId: string): Promise<ActionResult> => {
    try {
      const activatedWorker = await activateStaffMember(workerId);
      setStaff((currentStaff) =>
        currentStaff.map((worker) => (worker.id === workerId ? activatedWorker : worker)),
      );
      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (activateError) {
      return { ok: false, message: getErrorMessage(activateError) };
    }
  };

  const deactivateWorker = async (workerId: string): Promise<ActionResult> => {
    try {
      const deactivatedWorker = await deactivateStaffMember(workerId);
      setStaff((currentStaff) =>
        currentStaff.map((worker) => (worker.id === workerId ? deactivatedWorker : worker)),
      );
      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (deactivateError) {
      return { ok: false, message: getErrorMessage(deactivateError) };
    }
  };

  const deleteWorker = async (workerId: string): Promise<ActionResult> => {
    try {
      await deleteStaffMember(workerId);
      setStaff((currentStaff) => currentStaff.filter((worker) => worker.id !== workerId));
      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (deleteError) {
      return { ok: false, message: getErrorMessage(deleteError) };
    }
  };

  const createRole = async (values: RoleMutationValues): Promise<ActionResult> => {
    const normalizedName = normalizeText(values.name);

    if (!normalizedName) return { ok: false, message: "Naziv uloge je obavezan." };
    if (roleExists(normalizedName) && values.workerIds.length === 0) {
      return { ok: false, message: "Uloga sa ovim nazivom već postoji." };
    }

    try {
      await createStaffRole({ ...values, name: normalizedName, icon: values.icon.trim() || "◎" });
      await loadStaff();
      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (roleError) {
      return { ok: false, message: getErrorMessage(roleError) };
    }
  };

  const updateRole = async (oldRoleName: string, values: RoleMutationValues): Promise<ActionResult> => {
    const normalizedName = normalizeText(values.name);

    if (!normalizedName) return { ok: false, message: "Naziv uloge je obavezan." };
    if (!roles.includes(oldRoleName)) return { ok: false, message: "Uloga nije pronađena." };
    if (roleExists(normalizedName, oldRoleName)) {
      return { ok: false, message: "Uloga sa ovim nazivom već postoji." };
    }

    try {
      await updateStaffRole(oldRoleName, { ...values, name: normalizedName, icon: values.icon.trim() || "◎" });
      await loadStaff();

      if (roleFilter === oldRoleName) {
        setRoleFilter(normalizedName);
      }

      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (roleError) {
      return { ok: false, message: getErrorMessage(roleError) };
    }
  };

  const deleteRole = async (roleName: string): Promise<ActionResult> => {
    if (!roles.includes(roleName)) return { ok: false, message: "Uloga nije pronađena." };
    if (roles.length <= 1) return { ok: false, message: "Ne možete obrisati jedinu ulogu." };

    try {
      await deleteStaffRole(roleName);
      await loadStaff();

      if (roleFilter === roleName) {
        setRoleFilter("all");
      }

      notifyOwnerSidebarChanged();
      return { ok: true };
    } catch (roleError) {
      return { ok: false, message: getErrorMessage(roleError) };
    }
  };

  return {
    staff,
    filteredStaff,
    roles,
    roleIcons,
    counters,
    search,
    roleFilter,
    statusFilter,
    isLoading,
    error,
    refreshStaff: loadStaff,
    setSearch,
    setRoleFilter,
    setStatusFilter,
    createWorker,
    updateWorker,
    activateWorker,
    deactivateWorker,
    deleteWorker,
    createRole,
    updateRole,
    deleteRole,
  };
}
