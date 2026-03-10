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

## リリース手順

### 前提条件

- Publisher `j4rviscmd` がVSCode Marketplaceに存在すること
- GitHub Secret `VSCE_PAT` が設定されていること

### リリースフロー

1. **CHANGELOG.md の更新**（手動）
   - **英語で記述すること**
   - 新しいバージョンの変更内容を追記
   - フォーマット:
     ```markdown
     ## [x.x.x] - YYYY-MM-DD

     ### Added
     - 新機能の説明

     ### Fixed
     - バグ修正の説明
     ```

2. **package.json のバージョン更新**
   - `version` フィールドを更新

3. **mainブランチへマージ**
   - GitHub Actionsが自動的に実行:
     - タグ作成（`vx.x.x`）
     - VSCode Marketplaceへ公開
     - GitHub Release作成（CHANGELOG.mdの内容を反映）

### 注意事項

- **CHANGELOG.md は手動更新必須** - workflowは読み取りのみ
- **CHANGELOG.md は英語で記述** - 国際的なユーザー向け
- 同一バージョンのタグが存在する場合はスキップされる
