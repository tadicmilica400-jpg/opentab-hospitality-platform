// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { StaffMember } from "../../../../../entities/staff/staff.types";
import type {
  StaffDetailsData,
  StaffGender,
  StaffPerformancePoint,
  StaffShift,
  StaffTableAssignment,
  StaffTopItem,
} from "../../../../../entities/staff/staff-details.types";

const fallbackWorkers: StaffMember[] = [
  {
    id: "1",
    fullName: "Marko Petrović",
    gender: "male",
    username: "marko.p",
    password: "pass123",
    role: "Konobar",
    status: "active",
    avatarUrl: "",
    createdAt: "2026-04-01",
    updatedAt: "2026-04-01",
  },
  {
    id: "2",
    fullName: "Ana Jovanović",
    gender: "female",
    username: "ana.j",
    password: "pass123",
    role: "Šanker",
    status: "active",
    avatarUrl: "",
    createdAt: "2026-04-02",
    updatedAt: "2026-04-02",
  },
  {
    id: "3",
    fullName: "Nikola Ilić",
    gender: "male",
    username: "nikola.i",
    password: "pass123",
    role: "Konobar",
    status: "active",
    avatarUrl: "",
    createdAt: "2026-04-03",
    updatedAt: "2026-04-03",
  },
  {
    id: "4",
    fullName: "Vladimir Simić",
    gender: "male",
    username: "vladimir.s",
    password: "pass123",
    role: "Menadžer",
    status: "active",
    avatarUrl: "",
    createdAt: "2026-04-04",
    updatedAt: "2026-04-04",
  },
  {
    id: "5",
    fullName: "Jelena Đorđević",
    gender: "female",
    username: "jelena.dj",
    password: "pass123",
    role: "Konobar",
    status: "inactive",
    avatarUrl: "",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-05",
  },
];

function getNumberFromId(id: string) {
  const numericPart = Number(id.replace(/[^\d]/g, ""));

  if (Number.isFinite(numericPart) && numericPart > 0) {
    return numericPart;
  }

  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getInitialWorker(workerId: string, baseWorker?: StaffMember | null) {
  if (baseWorker) {
    return baseWorker;
  }

  return fallbackWorkers.find((worker) => worker.id === workerId) ?? fallbackWorkers[0];
}

function createTables(seed: number): StaffTableAssignment[] {
  return [
    {
      id: `table-main-${seed}`,
      tableNumber: `${10 + (seed % 8)}`,
      sector: "Glavna sala",
      status: "active",
      guests: 4,
      currentBill: 7200 + seed * 280,
      openedAt: "18:20",
    },
    {
      id: `table-terrace-${seed}`,
      tableNumber: `T${3 + (seed % 5)}`,
      sector: "Terasa",
      status: "waiting",
      guests: 2,
      currentBill: 3100 + seed * 190,
      openedAt: "19:05",
    },
    {
      id: `table-garden-${seed}`,
      tableNumber: `B${5 + (seed % 6)}`,
      sector: "Bašta",
      status: "reserved",
      guests: 6,
      currentBill: 0,
      openedAt: "20:30",
    },
  ];
}

function createSchedule(seed: number): StaffShift[] {
  return [
    {
      id: `shift-${seed}-1`,
      day: "Ponedeljak",
      date: "17. Jun",
      inputDate: "2026-06-17",
      startTime: "08:00",
      endTime: "16:00",
      time: "08:00 - 16:00",
      sector: seed % 2 === 0 ? "Glavna sala" : "Terasa",
      type: "Jutarnja",
      status: "confirmed",
    },
    {
      id: `shift-${seed}-2`,
      day: "Utorak",
      date: "18. Jun",
      inputDate: "2026-06-18",
      startTime: "16:00",
      endTime: "00:00",
      time: "16:00 - 00:00",
      sector: "Glavna sala",
      type: "Večernja",
      status: "confirmed",
    },
    {
      id: `shift-${seed}-3`,
      day: "Četvrtak",
      date: "20. Jun",
      inputDate: "2026-06-20",
      startTime: "14:00",
      endTime: "22:00",
      time: "14:00 - 22:00",
      sector: "Bašta",
      type: "Popodnevna",
      status: "pending",
    },
    {
      id: `shift-${seed}-4`,
      day: "Subota",
      date: "22. Jun",
      inputDate: "2026-06-22",
      startTime: "18:00",
      endTime: "02:00",
      time: "18:00 - 02:00",
      sector: "Glavna sala + Terasa",
      type: "Večernja",
      status: "confirmed",
    },
  ];
}

function createPerformance(seed: number): StaffPerformancePoint[] {
  return [
    {
      label: "Pon",
      revenue: 42000 + seed * 1200,
      orders: 46 + seed,
      tables: 18 + seed,
    },
    {
      label: "Uto",
      revenue: 51500 + seed * 980,
      orders: 51 + seed,
      tables: 21 + seed,
    },
    {
      label: "Sre",
      revenue: 48000 + seed * 1350,
      orders: 48 + seed,
      tables: 20 + seed,
    },
    {
      label: "Čet",
      revenue: 60200 + seed * 1100,
      orders: 57 + seed,
      tables: 24 + seed,
    },
    {
      label: "Pet",
      revenue: 73500 + seed * 1600,
      orders: 69 + seed,
      tables: 31 + seed,
    },
    {
      label: "Sub",
      revenue: 88200 + seed * 1700,
      orders: 78 + seed,
      tables: 36 + seed,
    },
    {
      label: "Ned",
      revenue: 54400 + seed * 900,
      orders: 53 + seed,
      tables: 22 + seed,
    },
  ];
}

function createTopItems(seed: number): StaffTopItem[] {
  return [
    {
      id: `item-espresso-${seed}`,
      name: "Espresso",
      category: "Kafe",
      quantity: 84 + seed,
      revenue: 16800 + seed * 200,
    },
    {
      id: `item-limonada-${seed}`,
      name: "Domaća limunada",
      category: "Sokovi",
      quantity: 48 + seed,
      revenue: 19200 + seed * 240,
    },
    {
      id: `item-burger-${seed}`,
      name: "Central burger",
      category: "Hrana",
      quantity: 31 + seed,
      revenue: 40300 + seed * 600,
    },
    {
      id: `item-pivo-${seed}`,
      name: "Točeno pivo",
      category: "Pića",
      quantity: 56 + seed,
      revenue: 28000 + seed * 330,
    },
  ];
}

function createPhone(seed: number) {
  return `+381 6${seed % 10} ${120 + seed} ${4000 + seed * 13}`;
}

function createBirthday(seed: number) {
  const year = 1990 + (seed % 9);
  const month = `${(seed % 9) + 1}`.padStart(2, "0");
  const day = `${10 + (seed % 18)}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getGender(seed: number): StaffGender {
  if (seed % 5 === 0) return "other";
  if (seed % 2 === 0) return "female";
  return "male";
}

function getSalary(role: string) {
  if (role === "Menadžer") {
    return "95000";
  }

  if (role === "Šanker") {
    return "78000";
  }

  return "72000";
}

function getShiftType(role: string) {
  if (role === "Menadžer") {
    return "Mešovite smene";
  }

  if (role === "Šanker") {
    return "Večernje smene";
  }

  return "Rotirajuće smene";
}

function getNote(role: string) {
  if (role === "Šanker") {
    return "Najbolji tempo rada ima tokom večernjih smena. Dobar za vikend šank i gužve.";
  }

  if (role === "Menadžer") {
    return "Zadužen za kontrolu smena, zatvaranje dana i rešavanje reklamacija.";
  }

  return "Stabilan radnik za salu. Dobro radi sa većim grupama, rezervacijama i aktivnim stolovima.";
}

export function createStaffDetailsData(workerId: string, baseWorker?: StaffMember | null): StaffDetailsData {
  const worker = getInitialWorker(workerId, baseWorker);
  const seed = getNumberFromId(worker.id);

  return {
    profile: {
      ...worker,
      email: `${worker.username.replace("@", "")}@opentab.rs`,
      phone: createPhone(seed),
      hireDate: worker.createdAt || "2026-04-01",
      birthday: createBirthday(seed),
      gender: worker.gender ?? getGender(seed),
      salary: getSalary(worker.role),
      shiftType: getShiftType(worker.role),
      rating: Math.min(5, 4.2 + (seed % 6) * 0.1),
      note: getNote(worker.role),
    },
    tables: createTables(seed),
    schedule: createSchedule(seed),
    performance: createPerformance(seed),
    topItems: createTopItems(seed),
  };
}