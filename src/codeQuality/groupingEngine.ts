import {
  DetectedIssue,
  DuplicateAnalysis,
  JavaAnalysisResult,
  MaintainabilityGroup,
  MaintainabilityIssueType,
} from "./analyzerTypes";

/**
 * Builds consolidated maintainability groups from raw
 * analyzer findings.
 *
 * Current grouping rules:
 *
 * 1. Non-duplication findings occurring in the same method
 *    are grouped together.
 *
 * 2. Findings occurring on the same class are grouped
 *    together.
 *
 * 3. Duplicated-logic relationships are treated as a graph.
 *    Connected methods become one duplication cluster.
 *
 * Priority calculation is intentionally NOT performed here.
 */
export function buildMaintainabilityGroups(
  analysis: Pick<
    JavaAnalysisResult,
    "fileName" | "methods" | "classes" | "duplicates"
  >,
): MaintainabilityGroup[] {
  const groups: MaintainabilityGroup[] = [];

  groups.push(...buildMethodGroups(analysis));

  groups.push(...buildClassGroups(analysis));

  groups.push(...buildDuplicationGroups(analysis));

  /*
   * Keep output deterministic and source-oriented.
   *
   * This makes testing easier and prevents groups from
   * appearing in random orders before the priority engine
   * is introduced.
   */
  return groups.sort((first, second) => first.startLine - second.startLine);
}

/**
 * Groups related findings that occur inside the same method.
 *
 * Duplicated Logic is deliberately excluded here because
 * duplication is a relationship between multiple methods
 * and is handled separately as a graph-based cluster.
 */
function buildMethodGroups(
  analysis: Pick<JavaAnalysisResult, "fileName" | "methods">,
): MaintainabilityGroup[] {
  const groups: MaintainabilityGroup[] = [];

  for (const method of analysis.methods) {
    const localIssues = method.issues.filter(
      (issue) => issue.type !== "Duplicated Logic",
    );

    if (localIssues.length === 0) {
      continue;
    }

    const issueTypes = getUniqueIssueTypes(localIssues);

    const groupingReason =
      localIssues.length > 1
        ? `${localIssues.length} related maintainability findings occur in the same method.`
        : `The maintainability finding is localized to this method.`;

    groups.push({
      id: `method:` + `${method.methodName}:` + `${method.startLine}`,

      kind: "Method",

      title:
        localIssues.length > 1
          ? "Method Maintainability Group"
          : "Method Maintainability Finding",

      fileName: analysis.fileName,

      primaryLocation: `${method.methodName}()`,

      startLine: method.startLine,

      endLine: method.endLine,

      affectedMethods: [method.methodName],

      affectedClasses: [],

      issueTypes,

      issues: localIssues,

      duplicatePairs: [],

      rawFindingCount: localIssues.length,

      groupingReason,
    });
  }

  return groups;
}

/**
 * Groups findings that apply to the same class.
 */
function buildClassGroups(
  analysis: Pick<JavaAnalysisResult, "fileName" | "classes">,
): MaintainabilityGroup[] {
  const groups: MaintainabilityGroup[] = [];

  for (const classItem of analysis.classes) {
    if (classItem.issues.length === 0) {
      continue;
    }

    const issueTypes = getUniqueIssueTypes(classItem.issues);

    const groupingReason =
      classItem.issues.length > 1
        ? `${classItem.issues.length} related maintainability findings occur at class level.`
        : `The maintainability finding applies to the overall class structure.`;

    groups.push({
      id: `class:` + `${classItem.className}:` + `${classItem.startLine}`,

      kind: "Class",

      title:
        classItem.issues.length > 1
          ? "Class Maintainability Group"
          : "Class Maintainability Finding",

      fileName: analysis.fileName,

      primaryLocation: classItem.className,

      startLine: classItem.startLine,

      endLine: classItem.endLine,

      affectedMethods: [],

      affectedClasses: [classItem.className],

      issueTypes,

      issues: classItem.issues,

      duplicatePairs: [],

      rawFindingCount: classItem.issues.length,

      groupingReason,
    });
  }

  return groups;
}

/**
 * Builds duplication groups using connected components.
 *
 * Each method is treated as a graph node.
 *
 * Each detected duplication relationship is treated as
 * an undirected edge.
 *
 * Example:
 *
 * A ↔ B
 * A ↔ C
 * B ↔ C
 *
 * becomes ONE cluster:
 *
 * { A, B, C }
 *
 * instead of three isolated warnings.
 */
function buildDuplicationGroups(
  analysis: Pick<JavaAnalysisResult, "fileName" | "duplicates">,
): MaintainabilityGroup[] {
  if (analysis.duplicates.length === 0) {
    return [];
  }

  const adjacency = buildDuplicationGraph(analysis.duplicates);

  const visited = new Set<string>();

  const groups: MaintainabilityGroup[] = [];

  for (const methodName of adjacency.keys()) {
    if (visited.has(methodName)) {
      continue;
    }

    const component = collectConnectedMethods(methodName, adjacency, visited);

    if (component.length < 2) {
      continue;
    }

    const componentSet = new Set(component);

    const relevantPairs = analysis.duplicates.filter(
      (duplicate) =>
        componentSet.has(duplicate.firstMethod) &&
        componentSet.has(duplicate.secondMethod),
    );

    if (relevantPairs.length === 0) {
      continue;
    }

    const orderedMethods = orderMethodsBySourceLocation(
      component,
      relevantPairs,
    );

    const startLine = getEarliestDuplicateLine(relevantPairs);

    const primaryLocation =
      orderedMethods.length === 2
        ? `${orderedMethods[0]}() ↔ ${orderedMethods[1]}()`
        : `${orderedMethods.length} related methods`;

    const groupingReason =
      orderedMethods.length === 2
        ? `These methods are connected by a strong duplicated-logic relationship.`
        : `${orderedMethods.length} methods form one connected duplicated-logic cluster across ${relevantPairs.length} pairwise relationship(s).`;

    groups.push({
      id: "duplication:" + orderedMethods.join("|"),

      kind: "Duplication Cluster",

      title: "Duplicated Logic Cluster",

      fileName: analysis.fileName,

      primaryLocation,

      startLine,

      affectedMethods: orderedMethods,

      affectedClasses: [],

      issueTypes: ["Duplicated Logic"],

      issues: [],

      duplicatePairs: relevantPairs,

      rawFindingCount: relevantPairs.length,

      groupingReason,
    });
  }

  return groups;
}

/**
 * Creates an undirected graph from duplicated-logic pairs.
 */
function buildDuplicationGraph(
  duplicates: DuplicateAnalysis[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const duplicate of duplicates) {
    addGraphEdge(adjacency, duplicate.firstMethod, duplicate.secondMethod);

    addGraphEdge(adjacency, duplicate.secondMethod, duplicate.firstMethod);
  }

  return adjacency;
}

function addGraphEdge(
  adjacency: Map<string, Set<string>>,
  from: string,
  to: string,
): void {
  if (!adjacency.has(from)) {
    adjacency.set(from, new Set<string>());
  }

  adjacency.get(from)?.add(to);
}

/**
 * Performs depth-first traversal to obtain one connected
 * duplication component.
 */
function collectConnectedMethods(
  startMethod: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
): string[] {
  const component: string[] = [];

  const stack: string[] = [startMethod];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    component.push(current);

    const neighbors = adjacency.get(current);

    if (!neighbors) {
      continue;
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return component;
}

/**
 * Orders methods according to their first known source
 * location rather than alphabetically.
 */
function orderMethodsBySourceLocation(
  methods: string[],
  duplicates: DuplicateAnalysis[],
): string[] {
  const startLines = new Map<string, number>();

  for (const duplicate of duplicates) {
    updateEarliestLine(
      startLines,
      duplicate.firstMethod,
      duplicate.firstStartLine,
    );

    updateEarliestLine(
      startLines,
      duplicate.secondMethod,
      duplicate.secondStartLine,
    );
  }

  return [...methods].sort(
    (first, second) =>
      (startLines.get(first) ?? Number.MAX_SAFE_INTEGER) -
      (startLines.get(second) ?? Number.MAX_SAFE_INTEGER),
  );
}

function updateEarliestLine(
  startLines: Map<string, number>,
  methodName: string,
  line: number,
): void {
  const existing = startLines.get(methodName);

  if (existing === undefined || line < existing) {
    startLines.set(methodName, line);
  }
}

function getEarliestDuplicateLine(duplicates: DuplicateAnalysis[]): number {
  let earliest = Number.MAX_SAFE_INTEGER;

  for (const duplicate of duplicates) {
    earliest = Math.min(
      earliest,
      duplicate.firstStartLine,
      duplicate.secondStartLine,
    );
  }

  return earliest === Number.MAX_SAFE_INTEGER ? 1 : earliest;
}

/**
 * Removes duplicate issue categories while preserving their
 * original order.
 */
function getUniqueIssueTypes(
  issues: DetectedIssue[],
): MaintainabilityIssueType[] {
  const seen = new Set<MaintainabilityIssueType>();

  const types: MaintainabilityIssueType[] = [];

  for (const issue of issues) {
    if (seen.has(issue.type)) {
      continue;
    }

    seen.add(issue.type);
    types.push(issue.type);
  }

  return types;
}
