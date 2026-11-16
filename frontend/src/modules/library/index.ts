// The library module: managing content, learning cards for now (ADR 0035).
// Code outside the module imports only what this file exports: its pages,
// and the load functions their routes' loaders call, each from its own file
// so a route's page stays in the route's chunk (ADR 0036).
export { CardNotFoundPage } from "./pages/card-not-found-page";
export { CardsPage } from "./pages/cards-page";
export { loadCardsPage } from "./pages/cards-page.load";
export { EditCardPage } from "./pages/edit-card-page";
export { loadEditCardPage } from "./pages/edit-card-page.load";
export { NewCardPage } from "./pages/new-card-page";
