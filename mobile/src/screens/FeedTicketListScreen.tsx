import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FeedTicketListItem } from "../types";

type Props = {
  items: FeedTicketListItem[];
  loading: boolean;
  onBack: () => void;
  onCreateNew: () => void;
  onOpenTicket: (ticketId: string) => void;
  onSearch: (filters: {
    ticketNumber: string | null;
    flockCode: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  }) => void;
};

export function FeedTicketListScreen({
  items,
  loading,
  onBack,
  onCreateNew,
  onOpenTicket,
  onSearch,
}: Props) {
  const [ticketNumber, setTicketNumber] = useState("");
  const [flockCode, setFlockCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePickerField, setDatePickerField] = useState<"from" | "to" | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => getMonthStart(new Date().toISOString().slice(0, 10)));

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.topButton}>
          <Text style={styles.topButtonText}>Back</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            onSearch({
              ticketNumber: ticketNumber.trim() || null,
              flockCode: flockCode.trim() || null,
              dateFrom: dateFrom.trim() || null,
              dateTo: dateTo.trim() || null,
            })
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Search</Text>
        </Pressable>
        <Pressable onPress={onCreateNew} style={styles.topButton}>
          <Text style={styles.topButtonText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.gridTwo}>
          <LabeledField label="Ticket #" value={ticketNumber} onChange={setTicketNumber} />
          <LabeledField label="Flock Code" value={flockCode} onChange={setFlockCode} />
        </View>

        <View style={styles.gridTwo}>
          <DateField label="From" value={dateFrom} onPress={() => {
            setCalendarCursor(getMonthStart(dateFrom || new Date().toISOString().slice(0, 10)));
            setDatePickerField("from");
          }} />
          <DateField label="To" value={dateTo} onPress={() => {
            setCalendarCursor(getMonthStart(dateTo || dateFrom || new Date().toISOString().slice(0, 10)));
            setDatePickerField("to");
          }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#8B572A" />
          <Text style={styles.loadingText}>Loading feed tickets...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenTicket(item.id)} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTicket}>{item.ticket_number || "Untitled Ticket"}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.delivery_date)}</Text>
                  <Text style={styles.cardVendor}>{item.vendor_name || "--"}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardWeight}>{formatWeight(item.ticket_weight_lbs)}</Text>
                  <Text style={styles.cardType}>{item.source_type || "--"}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Drops: {item.drop_count}</Text>
                <Text style={styles.metaText}>Allocated: {formatWeight(item.allocated_weight_lbs)}</Text>
                <Text style={[styles.metaText, item.remaining_weight_lbs === 0 ? styles.metaGood : styles.metaWarn]}>
                  Remain: {formatWeight(item.remaining_weight_lbs)}
                </Text>
              </View>

              <Text style={styles.farmLine}>{item.placement_codes.join(", ") || "No flock codes recorded"}</Text>
              <Text style={styles.barnLine}>{item.farm_names.join(", ") || "No farm assigned"}</Text>
              <Text style={styles.barnLine}>{item.barn_codes.join(", ") || "No barns recorded"}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No feed tickets found.</Text>
              <Text style={styles.emptyCopy}>Try a wider date range, ticket number, or flock code.</Text>
            </View>
          }
        />
      )}

      <CalendarModal
        currentDate={datePickerField === "from" ? dateFrom : dateTo}
        cursor={calendarCursor}
        visible={datePickerField !== null}
        onChangeCursor={setCalendarCursor}
        onClose={() => setDatePickerField(null)}
        onSelectDate={(nextDate) => {
          if (datePickerField === "from") {
            setDateFrom(nextDate);
          } else if (datePickerField === "to") {
            setDateTo(nextDate);
          }
          setDatePickerField(null);
        }}
      />
    </View>
  );
}

function LabeledField({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9A988F"
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

function DateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.dateButton}>
        <Text style={styles.dateButtonText}>{value || "Select Date"}</Text>
      </Pressable>
    </View>
  );
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "2-digit",
    year: "numeric",
  });
}

type CalendarModalProps = {
  currentDate: string;
  cursor: Date;
  visible: boolean;
  onChangeCursor: (next: Date) => void;
  onClose: () => void;
  onSelectDate: (nextDate: string) => void;
};

function CalendarModal({
  currentDate,
  cursor,
  visible,
  onChangeCursor,
  onClose,
  onSelectDate,
}: CalendarModalProps) {
  const days = buildCalendarDays(cursor);
  const currentMonthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => onChangeCursor(addMonths(cursor, -1))} style={styles.calendarArrowButton}>
              <Text style={styles.calendarArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{currentMonthLabel}</Text>
            <Pressable onPress={() => onChangeCursor(addMonths(cursor, 1))} style={styles.calendarArrowButton}>
              <Text style={styles.calendarArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.calendarWeekHeader}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <Text key={label} style={styles.calendarWeekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((day) => {
              const isoDate = toCalendarIso(day.date);
              const isCurrent = isoDate === currentDate;

              return (
                <Pressable
                  key={isoDate}
                  onPress={() => onSelectDate(isoDate)}
                  style={[
                    styles.calendarDayButton,
                    !day.inMonth && styles.calendarDayButtonMuted,
                    isCurrent && styles.calendarDayButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      !day.inMonth && styles.calendarDayTextMuted,
                      isCurrent && styles.calendarDayTextSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function getMonthStart(value: string) {
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(cursor: Date) {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstGridDay = new Date(monthStart);
  firstGridDay.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function toCalendarIso(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: 12,
  },
  topBar: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
  },
  topButton: {
    minWidth: 74,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  topButtonText: {
    color: "#73491F",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFF8EF",
    fontSize: 17,
    fontWeight: "800",
  },
  filterCard: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  gridTwo: {
    flexDirection: "row",
    gap: 10,
  },
  fieldBlock: {
    flex: 1,
    gap: 5,
  },
  fieldLabel: {
    color: "#6D8067",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldInput: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#1E231C",
    fontSize: 16,
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dateButton: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#D8BE99",
    backgroundColor: "#FFFCF6",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dateButtonText: {
    color: "#1E231C",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTicket: {
    color: "#A01828",
    fontSize: 24,
    fontWeight: "800",
  },
  cardDate: {
    color: "#5F5A51",
    fontSize: 13,
    fontWeight: "700",
  },
  cardVendor: {
    color: "#4E5550",
    fontSize: 15,
    fontWeight: "700",
  },
  cardRight: {
    alignItems: "flex-end",
  },
  cardWeight: {
    color: "#514DE1",
    fontSize: 24,
    fontWeight: "900",
  },
  cardType: {
    color: "#4A5AA8",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metaText: {
    color: "#6A5643",
    fontSize: 13,
    fontWeight: "700",
  },
  metaGood: {
    color: "#3E6031",
  },
  metaWarn: {
    color: "#A01828",
  },
  farmLine: {
    color: "#7B4B2A",
    fontSize: 14,
    fontWeight: "700",
  },
  barnLine: {
    color: "#6A5643",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#D8C9B2",
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: "#1F2A1F",
    fontSize: 19,
    fontWeight: "800",
  },
  emptyCopy: {
    color: "#556255",
    fontSize: 14,
    lineHeight: 20,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#556255",
    fontSize: 15,
    fontWeight: "600",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 10,
  },
  modalCloseButton: {
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#8B572A",
  },
  modalCloseText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
  calendarCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3E8D8",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarArrowText: {
    color: "#7A4A21",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 28,
  },
  calendarMonthLabel: {
    color: "#1F2A1F",
    fontSize: 20,
    fontWeight: "800",
  },
  calendarWeekHeader: {
    flexDirection: "row",
  },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    color: "#7A715F",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  calendarDayButton: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  calendarDayButtonMuted: {
    opacity: 0.35,
  },
  calendarDayButtonSelected: {
    backgroundColor: "#8B572A",
  },
  calendarDayText: {
    color: "#2A251E",
    fontSize: 16,
    fontWeight: "700",
  },
  calendarDayTextMuted: {
    color: "#877D70",
  },
  calendarDayTextSelected: {
    color: "#FFF8EF",
  },
});
