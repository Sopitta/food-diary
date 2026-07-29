import type { SVGProps } from "react";
import type { MealType } from "@/lib/meals/types";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 3v3.5M20.75 4.75H17.25" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z" />
    </svg>
  );
}

export function CoffeeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.5v3M12 19.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.5 12h3M19.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function CupIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 3h13l-1.4 15.2A3 3 0 0 1 14.1 21H9.9a3 3 0 0 1-3-2.8z" />
      <path d="M6.3 8.5h11.4" />
    </svg>
  );
}

export function DrumstickIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15.5 3a4.5 4.5 0 0 0-2 8.5c-2.1.9-3.5 2.6-5 4.1-1 1-1.9.9-2.9 1.9a2.7 2.7 0 1 0 3.8 3.8c1-1 .9-1.9 1.9-2.9 1.5-1.5 3.2-2.9 4.1-5a4.5 4.5 0 1 0 0-10.4z" />
    </svg>
  );
}

export function WheatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2v20" />
      <path d="M12 5.5 9.3 7.8M12 5.5l2.7 2.3" />
      <path d="M12 9.5 9.3 11.8M12 9.5l2.7 2.3" />
      <path d="M12 13.5 9.3 15.8M12 13.5l2.7 2.3" />
      <path d="M12 17.5 9.3 19.8M12 17.5l2.7 2.3" />
    </svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.7s6 6.5 6 10.6a6 6 0 0 1-12 0c0-4.1 6-10.6 6-10.6z" />
    </svg>
  );
}

export const MEAL_TYPE_META: Record<MealType, { label: string; Icon: (props: IconProps) => React.JSX.Element }> = {
  breakfast: { label: "Breakfast", Icon: CoffeeIcon },
  lunch: { label: "Lunch", Icon: SunIcon },
  dinner: { label: "Dinner", Icon: MoonIcon },
  snack: { label: "Snack", Icon: ClockIcon },
  drink: { label: "Drink", Icon: CupIcon },
};
