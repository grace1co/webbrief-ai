import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Saved from "./pages/Saved";
import History from "./pages/History";
import AnalysisLayout from "./pages/AnalysisLayout";
import Overview from "./pages/Overview";
import Ask from "./pages/Ask";
import Sources from "./pages/Sources";
import Brief from "./pages/Brief";
import Score from "./pages/Score";
import Compare from "./pages/Compare";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/saved" element={<Saved />} />
      <Route path="/history" element={<History />} />
      <Route path="/analysis/:id" element={<AnalysisLayout />}>
        <Route index element={<Overview />} />
        <Route path="ask" element={<Ask />} />
        <Route path="sources" element={<Sources />} />
        <Route path="brief" element={<Brief />} />
        <Route path="score" element={<Score />} />
        <Route path="compare" element={<Compare />} />
      </Route>
    </Routes>
  );
}
