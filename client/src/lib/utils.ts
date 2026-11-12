import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateDDMMYY(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const [year, month, day] = parts;
        const shortYear = year.length === 4 ? year.slice(2) : year;
        return `${day}/${month}/${shortYear}`;
      }
    }
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          return `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`;
        }
        return dateStr;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
