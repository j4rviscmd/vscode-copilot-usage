# VSCode Copilot Usage

## 開発方針

- **GitHub Flow準拠**: mainブランチへ直接コミット禁止。必ずfeatureブランチを作成すること。

## アーキテクチャ

### APIエンドポイント

- `https://api.github.com/copilot_internal/user` はGitHub内部API
- 変更される可能性があるため、将来的に修正が必要になる可能性あり

### キャッシュ戦略

- `globalState` を使用して複数ウィンドウ間でキャッシュを共有
- `version` フィールドでAPIレスポンス構造変更時の互換性を管理
- 現在のバージョン: `1.0`

### タイマー設計

- API呼び出し完了後にタイマーを再設定
- これにより設定間隔（`refreshInterval`）を正確に守る
- キャッシュヒット時はタイマー再設定なし

### 使用率計算

```typescript
used = entitlement - quota_remaining
percentage = (used / entitlement) * 100
```

データソース: `quota_snapshots.premium_interactions`
