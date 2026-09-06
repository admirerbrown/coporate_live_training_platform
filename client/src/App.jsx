import CreateSessionPage from "./pages/CreateSessionPage";

function App() {
  function handleSessionCreated(session) {
    console.log("Session created:", session);
  }

  return <CreateSessionPage onSessionCreated={handleSessionCreated} />;
}

export default App;
