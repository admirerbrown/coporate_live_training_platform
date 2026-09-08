import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router";

import CreateSessionPage from "./pages/CreateSessionPage";
import JoinSessionPage from "./pages/JoinSessionPage";
import InstructorSessionPage from "./pages/InstructorSessionPage";
import ParticipantSessionPage from "./pages/ParticipantSessionPage";

import { getSession } from "./api/sessions";

const instructorTokenKey = (sessionId) =>
  `training:instructor-token:${sessionId}`;

function CreateSessionRoute() {
  const navigate = useNavigate();

  function handleSessionCreated(session) {
    sessionStorage.setItem(
      instructorTokenKey(session.id),
      session.instructorToken,
    );

    navigate(`/sessions/${session.id}/instructor`);
  }

  return <CreateSessionPage onSessionCreated={handleSessionCreated} />;
}

function JoinSessionRoute() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  function handleJoined(session) {
    navigate(`/sessions/${session.id}/live`);
  }

  return <JoinSessionPage sessionId={sessionId} onJoined={handleJoined} />;
}

function SessionRouteLoader({ children }) {
  const { sessionId } = useParams();

  const [resource, setResource] = useState({
    sessionId: null,
    session: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    getSession(sessionId)
      .then((session) => {
        if (cancelled) {
          return;
        }

        setResource({
          sessionId,
          session,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setResource({
          sessionId,
          session: null,
          error:
            error instanceof Error ? error.message : "Failed to get session",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (resource.sessionId !== sessionId) {
    return (
      <main>
        <p role="status">Loading session...</p>
      </main>
    );
  }

  if (resource.error) {
    return (
      <main>
        <div role="alert">{resource.error}</div>
      </main>
    );
  }

  return children(resource.session);
}

function InstructorSessionRoute() {
  const { sessionId } = useParams();

  const instructorToken = sessionStorage.getItem(instructorTokenKey(sessionId));

  if (!instructorToken) {
    return (
      <main>
        <div role="alert">Instructor access is unavailable.</div>
      </main>
    );
  }

  return (
    <SessionRouteLoader>
      {(session) => (
        <InstructorSessionPage
          session={{
            ...session,
            instructorToken,
          }}
        />
      )}
    </SessionRouteLoader>
  );
}

function ParticipantSessionRoute() {
  return (
    <SessionRouteLoader>
      {(session) => <ParticipantSessionPage session={session} />}
    </SessionRouteLoader>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CreateSessionRoute />} />

      <Route path="/sessions/:sessionId/join" element={<JoinSessionRoute />} />

      <Route
        path="/sessions/:sessionId/instructor"
        element={<InstructorSessionRoute />}
      />

      <Route
        path="/sessions/:sessionId/live"
        element={<ParticipantSessionRoute />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
