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
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import CreateSessionPage from "../../pages/CreateSessionPage";

import { createSession } from "../../api/sessions";

vi.mock("../../api/sessions", () => ({
  createSession: vi.fn(),
}));

describe("CreateSessionPage", () => {
  const onSessionCreated = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the instructor session creation screen", () => {
    render(
      <CreateSessionPage
        onSessionCreated={onSessionCreated}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /create a training session/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /start a live training session by adding a name and youtube video/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/session name/i),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/youtube url/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Create Session",
        exact: true,
      }),
    ).toBeInTheDocument();
  });

  it("forwards a successfully created session to onSessionCreated", async () => {
    const session = {
      id: "session-123",
      name: "JavaScript Training",
    };

    createSession.mockResolvedValue(session);

    render(
      <CreateSessionPage
        onSessionCreated={onSessionCreated}
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/session name/i),
      {
        target: {
          value: "JavaScript Training",
        },
      },
    );

    fireEvent.change(
      screen.getByLabelText(/youtube url/i),
      {
        target: {
          value:
            "https://www.youtube.com/watch?v=test123",
        },
      },
    );

    fireEvent.submit(
      screen
        .getByLabelText(/session name/i)
        .closest("form"),
    );

    await vi.waitFor(() => {
      expect(onSessionCreated).toHaveBeenCalledWith(
        session,
      );
    });
  });
});
