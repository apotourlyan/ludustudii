// The library module: managing content, learning cards for now (ADR 0035).
// Code outside the module imports only what this file exports: its pages,
// and the load functions their routes' loaders call and the search
// validators their routes use, each from its own file so a route's page
// stays in the route's chunk (ADR 0036).
export { EditLearningCardPage } from "./pages/edit-learning-card-page";
export { loadEditLearningCardPage } from "./pages/edit-learning-card-page.load";
export { LearningCardNotFoundPage } from "./pages/learning-card-not-found-page";
export { LearningCardPage } from "./pages/learning-card-page";
export { loadLearningCardPage } from "./pages/learning-card-page.load";
export { LearningCardsPage } from "./pages/learning-cards-page";
export { loadLearningCardsPage } from "./pages/learning-cards-page.load";
export { validateLearningCardsPageSearch } from "./pages/learning-cards-page.search";
export { NewLearningCardPage } from "./pages/new-learning-card-page";
