import { AssistantModule } from "./hooks/useAssistantChat";
import {
  FiAlertTriangle,
  FiTrendingUp,
  FiBarChart2,
  FiCalendar,
  FiFileText,
  FiUsers,
  FiPackage,
  FiActivity,
  FiUser,
  FiHeart,
  FiCheckCircle,
} from "react-icons/fi";

export interface SuggestionChip {
  label: string;
  icon: React.ReactNode;
  subtitle: string;
  color: string;
  text: string;
}

export interface ModuleConfig {
  title: string;
  subtitle: string;
  welcomeMessage: string;
  suggestions: SuggestionChip[];
}

const PHARMACY_SUGGESTIONS: SuggestionChip[] = [
  { label: "Low stock alert", icon: <FiAlertTriangle />, subtitle: "Check medicines running low", color: "#3b82f6", text: "Which medicines are running low or out of stock?" },
  { label: "Today's revenue", icon: <FiTrendingUp />, subtitle: "View today's sales report", color: "#3b82f6", text: "What is today's pharmacy revenue?" },
  { label: "Top medicines", icon: <FiBarChart2 />, subtitle: "Best selling medicines", color: "#3b82f6", text: "Give me top 5 medicines by sales this month" },
  { label: "Expiry alerts", icon: <FiCalendar />, subtitle: "Medicines near expiry", color: "#3b82f6", text: "Show medicines expiring in the next 30 days" },
  { label: "Pending bills", icon: <FiFileText />, subtitle: "View outstanding bills", color: "#3b82f6", text: "Show all unpaid pharmacy bills" },
  { label: "Queue status", icon: <FiUsers />, subtitle: "Current queue overview", color: "#3b82f6", text: "How many patients are in the pharmacy queue?" },
  { label: "Reorder list", icon: <FiPackage />, subtitle: "Medicines to reorder", color: "#3b82f6", text: "What should we reorder this week?" },
  { label: "Pending dispense", icon: <FiActivity />, subtitle: "Uncompleted orders", color: "#3b82f6", text: "Show bills not yet dispensed" },
];

const PATIENT_SUGGESTIONS: SuggestionChip[] = [
  { label: "My bills", icon: <FiFileText />, subtitle: "View your pharmacy bills", color: "#3b82f6", text: "Show my pharmacy bills" },
  { label: "My prescriptions", icon: <FiHeart />, subtitle: "View your prescriptions", color: "#3b82f6", text: "Show my prescriptions" },
  { label: "My appointments", icon: <FiCalendar />, subtitle: "View your appointments", color: "#3b82f6", text: "Show my upcoming appointments" },
  { label: "Lab reports", icon: <FiActivity />, subtitle: "View your lab results", color: "#3b82f6", text: "Show my lab reports" },
  { label: "Payment history", icon: <FiCheckCircle />, subtitle: "View payment records", color: "#3b82f6", text: "Show my payment history" },
  { label: "Book appointment", icon: <FiUser />, subtitle: "Schedule a visit", color: "#3b82f6", text: "I want to book an appointment" },
];

export const MODULE_CONFIGS: Record<AssistantModule, ModuleConfig> = {
  pharmacy: {
    title: "MythoAI",
    subtitle: "by MQE Pharmacy",
    welcomeMessage: "Ask me anything about your pharmacy business. I'm here to help!",
    suggestions: PHARMACY_SUGGESTIONS,
  },
  patient: {
    title: "MythoAI",
    subtitle: "Patient Portal",
    welcomeMessage: "I'm your Patient Portal Assistant. Ask me about your prescriptions, bills, or appointments.",
    suggestions: PATIENT_SUGGESTIONS,
  },
};
