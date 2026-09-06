import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import InstructorSessionPage from "../../pages/InstructorSessionPage";

describe("InstructorSessionPage", () => {
  const baseSession = {
    id: "session-123",
    name: "JavaScript Training",
    youtubeUrl:
      "https://www.youtube.com/watch?v=test123",
    instructorToken: "secret-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the instructor session", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "JavaScript Training",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/instructor/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText("session-123"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "https://www.youtube.com/watch?v=test123",
      ),
    ).toBeInTheDocument();
  });

  it("shows Live for a live session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
          status: "LIVE",
        }}
      />,
    );

    expect(
      screen.getByText("Live"),
    ).toBeInTheDocument();
  });

  it("does not show Live for a created session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
          status: "CREATED",
        }}
      />,
    );

    expect(
      screen.queryByText("Live"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(/ready to start/i),
    ).toBeInTheDocument();
  });

  it("does not show Live for an ended session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
          status: "ENDED",
        }}
      />,
    );

    expect(
      screen.queryByText("Live"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(/ended/i),
    ).toBeInTheDocument();
  });

  it("does not expose the instructor token", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      screen.queryByText("secret-token"),
    ).not.toBeInTheDocument();
  });
});

