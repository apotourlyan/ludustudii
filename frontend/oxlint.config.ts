// ADR 0033, written in TypeScript by ADR 0037. `make frontend-lint` runs
// Oxlint with this file; the options below apply in the editor too.
import { defineConfig, type DummyRuleMap } from "oxlint";

/** A package, or some of its exports, that may not be imported. */
type RestrictedPath = { name: string; importNames?: string[]; message: string };
/**
 * Import paths that may not be imported: a regex, or a gitignore group;
 * with allowTypeImports, only `import type` of them is allowed.
 */
type RestrictedPattern = ({ regex: string } | { group: string[] }) & {
  message: string;
  allowTypeImports?: boolean;
};
type Restriction = RestrictedPath | RestrictedPattern;

// ---- Everywhere

// Phosphor's main entry, which loads every icon in development.
const phosphorMainEntry: RestrictedPath = {
  name: "@phosphor-icons/react",
  message:
    "Import each icon from @phosphor-icons/react/dist/csr/<Name>. In development, Vite pre-bundles the package's main entry as one module of every icon, and evaluating it blocks the page for seconds on a slow machine.",
};

// ---- The API layer (ADR 0030, 0031)

const fetchOutsideApi: DummyRuleMap["no-restricted-globals"] = [
  "error",
  {
    globals: [
      {
        name: "fetch",
        message:
          "openapi-fetch in src/api/ is the only HTTP client; use the service's query options or mutation hooks from @/api/<service> (ADR 0031).",
      },
    ],
    // Also window.fetch, globalThis.fetch and self.fetch.
    checkGlobalObject: true,
  },
];

const queryHooksOutsideApi: RestrictedPath = {
  name: "@tanstack/react-query",
  importNames: ["useQuery", "useQueryClient", "useQueries", "useInfiniteQuery", "useMutation"],
  message:
    "Read data with useSuspenseQuery and the API layer's query options, and change it with the API layer's mutation hooks (ADR 0030).",
};

// openapi-fetch's subpaths as well as the package.
const openapiFetchOutsideApi: RestrictedPattern = {
  regex: "^openapi-fetch(/|$)",
  message:
    "Only src/api/ makes requests; use the service's query options or mutation hooks from @/api/<service> (ADR 0031).",
};

const serviceIndexMessage = "Import a service only through its index, @/api/<service> (ADR 0030).";

// Matches the alias and relative paths (./api/, ../api/, ./../api/...).
const serviceIndexOnly: RestrictedPattern = {
  regex: "^(@|\\.{1,2}(/\\.{1,2})*)/api/[^/]+/",
  message: serviceIndexMessage,
};

// For src/mock/ and tests, service internals are a gitignore group, so a
// service's fake/ folder can be negated. Oxlint applies a group's negations to every
// pattern of the rule, so no other pattern next to it may match a path under
// fake/.
const serviceIndexOnlyInMock: RestrictedPattern = {
  group: ["**/api/*/**", "!**/api/*/fake", "!**/api/*/fake/**", "!**/api/fake", "!**/api/fake/**"],
  message: serviceIndexMessage,
};

// ---- The fakes (ADR 0032)

const fakesOnlyInMock: RestrictedPattern = {
  regex: "(^|/)fake(/|$)",
  message: "Only src/mock/ and tests import the fakes (ADR 0032).",
};

// @/api/fake, ./fake, ./fake/store, ../fake/http and so on.
const fakesInApiProduction: RestrictedPattern = {
  regex: "(^|/)fake(/|$)",
  message:
    "Production modules in src/api/ don't import the fakes; only src/mock/ and tests do, so the fakes stay out of the production bundle (ADR 0032).",
};

const mswInApiProduction: RestrictedPattern = {
  regex: "^(openapi-)?msw(/|$)",
  message:
    "Production modules in src/api/ don't import MSW; only the fakes and src/mock/ do, so it stays out of the production bundle (ADR 0032).",
};

// ---- Modules and src/shared/ (ADR 0035)

// Outside a module, only its index.
const moduleIndexOnly: RestrictedPattern = {
  regex: "^(@|\\.{1,2}(/\\.{1,2})*)/modules/[^/]+/",
  message: "Import a module only through its index, @/modules/<module> (ADR 0035).",
};

// Inside a module, no module may be imported by alias, which keeps out other
// modules and makes a module's own imports relative, nor the shell or the
// routes. The rules name no module, so a new module needs no change here.
const noOtherModules: RestrictedPattern = {
  regex: "^@/modules(/|$)",
  message:
    "A module doesn't import another module: modules connect through URLs, and src/app/ combines them. Inside a module, imports are relative (ADR 0035).",
};

const noShellOrRoutes: RestrictedPattern = {
  regex: "^@/(app|routes)(/|$)|^@/routeTree\\.gen",
  message:
    "A module doesn't import the shell (src/app/) or the routes; they import the module's index (ADR 0035).",
};

// A relative import may climb no higher than the module's root, so how far
// depends on the file's depth: none from the root (index.ts), one level from
// pages/, components/ or model/, and two from anything deeper. Files nested
// more than two folders deep can climb only two levels. Climbing exactly to
// the module's root reaches its index, which is for code outside the module.
const climbMessage =
  "A relative import stays inside its module. Import shared code by its alias (@/shared/...), and never another module (ADR 0035).";
const ownIndexMessage =
  "Inside a module, import the file you need, not the module's own index: the index is for code outside the module (ADR 0035).";

const climbOutOfModuleAtRoot: RestrictedPattern = {
  regex: "^(\\./)*\\.\\.(/|$)",
  message: climbMessage,
};
const ownIndexAtRoot: RestrictedPattern = {
  regex: "^\\.(/index(\\.[jt]sx?)?)?/?$",
  message: ownIndexMessage,
};

const climbOutOfModuleOneDown: RestrictedPattern = {
  regex: "^(\\./)*\\.\\./(\\./)*\\.\\.(/|$)",
  message: climbMessage,
};
const ownIndexOneDown: RestrictedPattern = {
  regex: "^(\\./)*\\.\\.(/index(\\.[jt]sx?)?)?/?$",
  message: ownIndexMessage,
};

const climbOutOfModuleDeeper: RestrictedPattern = {
  regex: "^(\\./)*(\\.\\./(\\./)*){2}\\.\\.(/|$)",
  message: climbMessage,
};
const ownIndexDeeper: RestrictedPattern = {
  regex: "^(\\./)*\\.\\./(\\./)*\\.\\.(/index(\\.[jt]sx?)?)?/?$",
  message: ownIndexMessage,
};

// A path with a .. after a folder name (./pages/../../x) could hide a climb,
// so it is rejected in the modules and in src/shared/.
const dotDotAfterFolder: RestrictedPattern = {
  regex: "(^|/)([^/.][^/]*|\\.[^/.][^/]*|\\.\\.[^/]+)/\\.\\.(/|$)",
  message:
    "Write relative paths without a .. after a folder name (./pages/../x), so the boundaries can check them (ADR 0035).",
};

// A gitignore group so that @/api/http can be negated; no other pattern in
// the src/shared/ override matches it.
const sharedApiOnlyHttp: RestrictedPattern = {
  group: ["**/api/**", "!**/api/http"],
  message:
    "src/shared/ imports only @/api/http from the API layer; a module uses the services (ADR 0035).",
};

const sharedKnowsNoModule: RestrictedPattern = {
  regex:
    "^(@|\\.{1,2}(/\\.{1,2})*)/(app|modules|routes)(/|$)|^(@|\\.{1,2}(/\\.{1,2})*)/routeTree\\.gen",
  message:
    "src/shared/ knows no module: it imports nothing from src/app/, src/routes/ or src/modules/ (ADR 0035).",
};

// ---- Feedback (ADR 0041)

// Base UI's Toast, through its subpath or its main entry, and the shadcn
// component built on it. src/shared/notify.ts adds the toasts and src/app/
// mounts the toaster; everything else reports through notifyError.
const toastMessage =
  "Report a failure with notifyError from @/shared/notify; only src/shared/ and src/app/ use the toast component (ADR 0041).";

const toastEntryOutsideShell: RestrictedPath = {
  name: "@base-ui/react",
  importNames: ["Toast"],
  message: toastMessage,
};

const toastOutsideShell: RestrictedPattern = {
  regex: "^@base-ui/react/toast(/|$)|^(@|\\.{1,2}(/\\.{1,2})*)/shared/ui/toast(\\.tsx?)?$",
  message: toastMessage,
};

// ---- A module's components (ADR 0036)

// The whole package, which includes the hooks ADR 0030 rules out everywhere.
const queryInComponents: RestrictedPath = {
  name: "@tanstack/react-query",
  message: "Components take data as props; pages read queries, widgets own theirs (ADR 0036).",
};

const navigationInComponents: RestrictedPath = {
  name: "@tanstack/react-router",
  importNames: ["useNavigate", "useRouter", "Navigate", "redirect"],
  message:
    "Components don't navigate; report the outcome through a callback for the page to act on (ADR 0036).",
};

// Everything that reads the current route's state: params, search, loader
// data and deps, route context, matches, location and router state. Links
// and link options stay allowed.
const routeDataInComponents: RestrictedPath = {
  name: "@tanstack/react-router",
  importNames: [
    "useParams",
    "useSearch",
    "useLoaderData",
    "useLoaderDeps",
    "useRouteContext",
    "useMatch",
    "useMatches",
    "useParentMatches",
    "useChildMatches",
    "useLocation",
    "useRouterState",
    "getRouteApi",
    "RouteApi",
    "useMatchRoute",
    "MatchRoute",
    "useCanGoBack",
  ],
  message: "Components get route data as props from their page (ADR 0036).",
};

const widgetsInComponents: RestrictedPattern = {
  regex: "(^|/)widgets(/|$)",
  message: "Components don't render widgets; pages do (ADR 0036).",
};

// ---- Component structure (ADR 0042)

const modelMessage =
  "A module's model/ is plain TypeScript: rules and decisions as functions, without React, TanStack, UI or components, and only types from the API layer (ADR 0042).";

// React and the React DOM renderer, and their subpaths.
const reactInModel: RestrictedPattern = {
  regex: "^react(-dom)?(/|$)",
  message: modelMessage,
};

// Every TanStack package: Query, Router, Form, Virtual.
const tanstackInModel: RestrictedPattern = {
  regex: "^@tanstack/",
  message: modelMessage,
};

const sharedUiInModel: RestrictedPattern = {
  regex: "^(@|\\.{1,2}(/\\.{1,2})*)/shared/ui(/|$)",
  message: modelMessage,
};

// ../components/..., ../pages/... and ../widgets/... from model/: a
// module's components, wherever they live.
const componentsInModel: RestrictedPattern = {
  regex: "^(\\.{1,2}/)+(components|pages|widgets)(/|$)",
  message: modelMessage,
};

// Any import from the API layer but `import type`, by alias or relative
// path.
const apiValuesInModel: RestrictedPattern = {
  regex: "^(@|\\.{1,2}(/\\.{1,2})*)/api(/|$)",
  allowTypeImports: true,
  message: modelMessage,
};

// The API layer, types included, by alias or relative path. A view's props
// type comes from its state hook (ADR 0042).
const apiInViews: RestrictedPattern = {
  regex: "^(@|\\.{1,2}(/\\.{1,2})*)/api(/|$)",
  message:
    "A view renders its props: it imports nothing from the API layer; its state hook reads and changes data (ADR 0042).",
};

// The whole package: a view holds no data hooks (ADR 0042).
const queryInViews: RestrictedPath = {
  name: "@tanstack/react-query",
  message:
    "A view renders its props: it holds no data or mutation hooks; its state hook does (ADR 0042).",
};

// An override replaces a rule's options instead of merging them, so each
// override that sets no-restricted-imports lists every restriction that
// applies to its files; of two overrides that set it for a file, the later
// one applies. This puts each restriction in `paths` (a package) or
// `patterns` (a regex or a gitignore group), keeping their order.
function restrictImports(
  ...restrictions: Restriction[]
): ["error", { paths: RestrictedPath[]; patterns: RestrictedPattern[] }] {
  return [
    "error",
    {
      paths: restrictions.filter((r): r is RestrictedPath => "name" in r),
      patterns: restrictions.filter((r): r is RestrictedPattern => !("name" in r)),
    },
  ];
}

export default defineConfig({
  options: {
    typeAware: true,
    denyWarnings: true,
    reportUnusedDisableDirectives: "deny",
  },
  plugins: ["typescript", "react", "jsx-a11y", "import", "unicorn", "oxc"],
  categories: {
    correctness: "error",
    suspicious: "error",
  },
  ignorePatterns: ["src/api/schema.gen.ts", "src/routeTree.gen.ts"],
  rules: {
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    // Not in the categories above (pedantic). Flags uses of APIs marked
    // @deprecated, such as React's FormEvent.
    "typescript/no-deprecated": "error",
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    // Not in the categories above. Fast Refresh keeps component state only
    // in files that export nothing but components.
    "react/only-export-components": "error",
    // The automatic JSX runtime (react-jsx) needs no React in scope.
    "react/react-in-jsx-scope": "off",
    // Flags libraries the React Compiler can't memoize; the app doesn't use
    // the compiler.
    "react/incompatible-library": "off",
    // useEffect callbacks return a cleanup on some paths and nothing on
    // others, which is what React expects.
    "typescript/consistent-return": "off",
    // [...value].length counts code points on purpose, as the server does.
    "typescript/no-misused-spread": "off",
    // Markup reads named values; a choice between more than two goes into a
    // named value or the state hook (ADR 0042).
    "no-nested-ternary": "error",
    // Braces around every body of if, else, for, while and do, even a
    // one-line return.
    curly: ["error", "all"],
    "no-restricted-imports": restrictImports(
      phosphorMainEntry,
      moduleIndexOnly,
      toastEntryOutsideShell,
      toastOutsideShell,
    ),
    // Side-effect imports of style sheets are how CSS is loaded.
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
  },
  overrides: [
    {
      // Route files export `Route` alongside the component it renders, as
      // TanStack Router's file-based routing requires.
      files: ["src/routes/**"],
      rules: {
        "react/only-export-components": "off",
      },
    },
    {
      // shadcn's components keep their upstream style, so updates from
      // shadcn apply without edits.
      files: ["src/shared/ui/**"],
      rules: {
        curly: "off",
      },
    },
    {
      // Module boundaries outside the API layer (ADR 0033), and outside a
      // module, its index only (ADR 0035), and no toasts but through
      // notifyError (ADR 0041). A fake inside a service folder gets both
      // messages. src/app/, src/mock/, src/shared/ and src/modules/ set their
      // own import rule below; the fetch rule still applies to src/app/,
      // src/shared/ and src/modules/.
      files: ["src/**"],
      excludeFiles: ["src/api/**", "src/mock/**"],
      rules: {
        "no-restricted-globals": fetchOutsideApi,
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          moduleIndexOnly,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // Tests (ADR 0043), and the helpers they share in src/test/, may
      // import the fakes and MSW, to seed the fake backend and change what
      // it answers, through the fakes' own files. The other boundaries of
      // the code next to them still apply, so each override below that
      // sets the import rule for code is followed by one for its tests.
      files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"],
      excludeFiles: ["src/api/**", "src/mock/**"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          moduleIndexOnly,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // The shell mounts the toaster (ADR 0041); the boundaries above
      // still apply.
      files: ["src/app/**"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          moduleIndexOnly,
        ),
      },
    },
    {
      // The shell's tests (ADR 0043).
      files: ["src/app/**/*.test.ts", "src/app/**/*.test.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          moduleIndexOnly,
        ),
      },
    },
    {
      // src/shared/ is used by every module and knows none of them (ADR
      // 0035): nothing from the shell, the routes or the modules, and from
      // the API layer only the shared HTTP client's types and errors.
      files: ["src/shared/**"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          fakesOnlyInMock,
          sharedApiOnlyHttp,
          sharedKnowsNoModule,
          dotDotAfterFolder,
        ),
      },
    },
    {
      // Module boundaries (ADR 0035), in three overrides that differ only in
      // the two restrictions that depend on the file's depth. This one is
      // for a module's root, such as index.ts.
      files: ["src/modules/*/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleAtRoot,
          ownIndexAtRoot,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // Tests at a module's root (ADR 0043).
      files: ["src/modules/*/*.test.ts", "src/modules/*/*.test.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleAtRoot,
          ownIndexAtRoot,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // A file one folder down in a module, such as
      // pages/learning-cards-page.tsx.
      files: ["src/modules/*/*/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // Tests one folder down in a module, such as model/'s (ADR 0043).
      files: ["src/modules/*/*/*.test.ts", "src/modules/*/*/*.test.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // A module's model/ (ADR 0042): plain functions, which import no
      // React, no TanStack, no UI and none of the module's components,
      // pages or widgets, and from the API layer only types; the boundaries one folder
      // down still apply. Comes after the overrides above, so it applies to
      // these files instead.
      files: ["src/modules/*/model/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
          reactInModel,
          tanstackInModel,
          sharedUiInModel,
          componentsInModel,
          apiValuesInModel,
        ),
      },
    },
    {
      // model/'s tests (ADR 0043) build the API layer's errors and may use
      // the fakes; the rest of model/'s boundaries apply.
      files: ["src/modules/*/model/*.test.ts", "src/modules/*/model/*.test.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
          reactInModel,
          tanstackInModel,
          sharedUiInModel,
          componentsInModel,
        ),
      },
    },
    {
      // A module's components (ADR 0036): data comes in as props and
      // outcomes go out through callbacks, so a component reads no query,
      // doesn't navigate and renders no widget. It comes after the override
      // above, so it applies to these files instead. A component may still
      // call the API layer's mutation hooks for the interaction it owns.
      files: ["src/modules/*/components/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryInComponents,
          navigationInComponents,
          routeDataInComponents,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          widgetsInComponents,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // A module's component tests (ADR 0043): a test renders what it
      // tests with the helpers in src/test/, which provide the query client.
      files: ["src/modules/*/components/*.test.ts", "src/modules/*/components/*.test.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryInComponents,
          navigationInComponents,
          routeDataInComponents,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          widgetsInComponents,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // A component's view (ADR 0042) renders its props: on top of the
      // components' boundaries, nothing from the API layer, types included.
      // A view's test (.view.test.tsx) isn't matched, and keeps the test
      // override above.
      files: ["src/modules/*/components/*.view.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryInViews,
          navigationInComponents,
          routeDataInComponents,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleOneDown,
          ownIndexOneDown,
          dotDotAfterFolder,
          widgetsInComponents,
          toastEntryOutsideShell,
          toastOutsideShell,
          apiInViews,
        ),
      },
    },
    {
      // A file two or more folders down in a module.
      files: ["src/modules/**"],
      excludeFiles: ["src/modules/*/*", "src/modules/*/*/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnly,
          fakesOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleDeeper,
          ownIndexDeeper,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // Tests two or more folders down in a module (ADR 0043).
      files: ["src/modules/**/*.test.ts", "src/modules/**/*.test.tsx"],
      excludeFiles: ["src/modules/*/*", "src/modules/*/*/*"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          noOtherModules,
          noShellOrRoutes,
          climbOutOfModuleDeeper,
          ownIndexDeeper,
          dotDotAfterFolder,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // The mock mode's start-up and scenarios seed and assemble the fakes
      // (ADR 0032); every other boundary above still applies.
      files: ["src/mock/**"],
      rules: {
        "no-restricted-globals": fetchOutsideApi,
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          queryHooksOutsideApi,
          openapiFetchOutsideApi,
          serviceIndexOnlyInMock,
          moduleIndexOnly,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // The API layer's production modules ship in the production bundle,
      // so they import neither the fakes nor MSW (ADR 0032). The fakes
      // themselves are excluded: they import each other and MSW, and only
      // the mock mode loads them. excludeFiles rather than negated patterns,
      // which would cancel the other patterns of the group.
      files: ["src/api/**"],
      excludeFiles: ["src/api/fake.ts", "src/api/fake/**", "src/api/*/fake/**"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          fakesInApiProduction,
          mswInApiProduction,
          moduleIndexOnly,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
    {
      // The API layer's tests (ADR 0043), which may drive a request with
      // MSW or the fakes.
      files: ["src/api/**/*.test.ts", "src/api/**/*.test.tsx"],
      excludeFiles: ["src/api/fake.ts", "src/api/fake/**", "src/api/*/fake/**"],
      rules: {
        "no-restricted-imports": restrictImports(
          phosphorMainEntry,
          moduleIndexOnly,
          toastEntryOutsideShell,
          toastOutsideShell,
        ),
      },
    },
  ],
});
