import CreateSessionForm from "../components/sessions/CreateSessionForm";

export default function CreateSessionPage({ onSessionCreated }) {
  return (
    <main>
      <h1>Create a Training Session</h1>

      <p>Start a live training session by adding a name and YouTube video.</p>

      <CreateSessionForm onSuccess={onSessionCreated} />
    </main>
  );
}
