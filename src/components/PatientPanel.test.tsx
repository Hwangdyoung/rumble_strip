import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientPanel } from "./PatientPanel";

vi.mock("./PatientDetail", () => ({ PatientDetail: ({ id }: { id: string }) => <div data-testid="detail">{id}</div> }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
afterEach(cleanup);

describe("Patient panel selection", () => {
  it("opens the URL-selected patient and follows the supplied list order", () => {
    const onSelect = vi.fn();
    const view = render(<PatientPanel patientId="b" patientIds={["c", "b", "a"]} onSelect={onSelect} />);
    expect(screen.getByTestId("detail")).toHaveTextContent("b");
    fireEvent.click(screen.getByRole("button", { name: "이전 환자" }));
    expect(onSelect).toHaveBeenLastCalledWith("c");
    fireEvent.click(screen.getByRole("button", { name: "다음 환자" }));
    expect(onSelect).toHaveBeenLastCalledWith("a");
    view.rerender(<PatientPanel patientId="a" patientIds={["c", "b", "a"]} onSelect={onSelect} />);
    expect(screen.getByTestId("detail")).toHaveTextContent("a");
    expect(screen.getByRole("button", { name: "다음 환자" })).toBeDisabled();
  });

  it("disables navigation outside the visible list and clears selection with X", () => {
    const onSelect = vi.fn();
    render(<PatientPanel patientId="linked" patientIds={["c", "b"]} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "이전 환자" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 환자" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "상세 패널 닫기" }));
    expect(onSelect).toHaveBeenCalledWith();
  });
});