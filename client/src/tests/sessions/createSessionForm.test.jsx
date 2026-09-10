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

import CreateSessionForm from "../../components/sessions/CreateSessionForm";

import { createSession } from "../../api/sessions";

vi.mock("../../api/sessions", () => ({
  createSession: vi.fn(),
}));

describe("CreateSessionForm", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function renderForm() {
    return render(
      <CreateSessionForm onSuccess={onSuccess} />,
    );
  }

  function fillForm() {
    fireEvent.change(
      screen.getByLabelText(/session name/i),
      {
        target: {
          value: "JavaScript Training",
        },
      },
    );

    fireEvent.change(
      screen.getByLabelText(/video url/i),
      {
        target: {
          value:
            "https://www.youtube.com/watch?v=test123",
        },
      },
    );
  }

  function getForm() {
    return screen
      .getByLabelText(/session name/i)
      .closest("form");
  }

  it("renders both required fields", () => {
    renderForm();

    expect(
      screen.getByLabelText(/session name/i),
    ).toBeRequired();

    expect(
      screen.getByLabelText(/video url/i),
    ).toBeRequired();

    expect(
      screen.getByRole("button", {
        name: "Create Session",
        exact: true,
      }),
    ).toBeInTheDocument();
  });

  it("sends the entered name and video URL", () => {
    createSession.mockResolvedValue({
      id: "session-123",
    });

    renderForm();
    fillForm();

    fireEvent.submit(getForm());

    expect(createSession).toHaveBeenCalledWith({
      name: "JavaScript Training",
      youtubeUrl:
        "https://www.youtube.com/watch?v=test123",
    });
  });

  it("disables the inputs and button while submitting", async () => {
    let resolveRequest;

    createSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderForm();
    fillForm();

    fireEvent.submit(getForm());

    expect(
      screen.getByLabelText(/session name/i),
    ).toBeDisabled();

    expect(
      screen.getByLabelText(/video url/i),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: /creating session/i,
      }),
    ).toBeDisabled();

    resolveRequest({
      id: "session-123",
    });

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        id: "session-123",
      });
    });
  });

  it("calls onSuccess with the created session", async () => {
    const session = {
      id: "session-123",
      name: "JavaScript Training",
      youtubeUrl:
        "https://www.youtube.com/watch?v=test123",
      instructorToken: "secret-token",
    };

    createSession.mockResolvedValue(session);

    renderForm();
    fillForm();

    fireEvent.submit(getForm());

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(session);
    });
  });

  it("displays the API error", async () => {
    createSession.mockRejectedValue(
      new Error("Invalid session name"),
    );

    renderForm();
    fillForm();

    fireEvent.submit(getForm());

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Invalid session name");
  });

  it("prevents duplicate submissions while the request is pending", () => {
    createSession.mockReturnValue(
      new Promise(() => {}),
    );

    renderForm();
    fillForm();

    const form = getForm();

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("preserves entered values and allows retry after an error", async () => {
    const session = {
      id: "session-123",
      name: "JavaScript Training",
      youtubeUrl:
        "https://www.youtube.com/watch?v=test123",
    };

    createSession
      .mockRejectedValueOnce(
        new Error("Server unavailable"),
      )
      .mockResolvedValueOnce(session);

    renderForm();
    fillForm();

    const form = getForm();

    fireEvent.submit(form);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Server unavailable");

    expect(
      screen.getByLabelText(/session name/i),
    ).toHaveValue("JavaScript Training");

    expect(
      screen.getByLabelText(/video url/i),
    ).toHaveValue(
      "https://www.youtube.com/watch?v=test123",
    );

    expect(
      screen.getByRole("button", {
        name: "Create Session",
        exact: true,
      }),
    ).not.toBeDisabled();

    fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(createSession).toHaveBeenCalledTimes(2);
    });

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(session);
    });
  });
});

