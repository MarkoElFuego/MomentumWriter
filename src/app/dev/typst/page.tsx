import { notFound } from "next/navigation";
import { TypstProbe } from "./TypstProbe";

// P0 (ZADATAK_IZVOZ): trial of Typst in the browser — only in development.
export default function TypstProbePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TypstProbe />;
}
