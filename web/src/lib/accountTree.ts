export type TreeRow = { id: string; parent_id: string | null; name: string }
export type TreeNode<T extends TreeRow> = T & { children: TreeNode<T>[]; depth: number }

// Düz satırlardan ağaç kurar. Üstü listede olmayan (ör. arşivli) satır kök sayılır. Kardeşler ada göre sıralanır.
export function buildTree<T extends TreeRow>(rows: T[], locale = 'tr'): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>(rows.map((r) => [r.id, { ...r, children: [], depth: 0 }]))
  const roots: TreeNode<T>[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (nodes: TreeNode<T>[], depth: number) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, locale))
    for (const n of nodes) {
      n.depth = depth
      sort(n.children, depth + 1)
    }
  }
  sort(roots, 0)
  return roots
}

// Ön-sıra düzleştirme (üst, sonra altları).
export function flatten<T extends TreeRow>(nodes: TreeNode<T>[]): TreeNode<T>[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)])
}

export function descendantIds<T extends TreeRow>(node: TreeNode<T>): Set<string> {
  return new Set(flatten([node]).map((n) => n.id))
}
