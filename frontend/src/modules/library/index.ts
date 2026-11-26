// The library module: managing content, learning cards for now (ADR 0035).
// Code outside the module imports only what this file exports: its pages,
// and the load functions their routes' loaders call and the search
// validators their routes use, each from its own file so a route's page
// stays in the route's chunk (ADR 0036).
export { LearningCardEditPage } from "./pages/learning-card-edit-page";
export { loadLearningCardEditPage } from "./pages/learning-card-edit-page.load";
export { LearningCardNewPage } from "./pages/learning-card-new-page";
export { LearningCardNotFoundPage } from "./pages/learning-card-not-found-page";
export { LearningCardPage } from "./pages/learning-card-page";
export { loadLearningCardPage } from "./pages/learning-card-page.load";
export { LearningCardsPage } from "./pages/learning-cards-page";
export { loadLearningCardsPage } from "./pages/learning-cards-page.load";
export { validateLearningCardsPageSearch } from "./pages/learning-cards-page.search";
