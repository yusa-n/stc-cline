export const template = `
name: {{project_name}}
description: {{project_description}}
version: {{version}}  # セマンティックバージョニング
status: {{status}}

# 基本構造定義
directories:  # ディレクトリ構造がある場合
  - name: /{{directory_name}}
    description: {{directory_description}}
    status: {{status}}
    directories:  # サブディレクトリ（必要に応じて）
      - name: /{{subdirectory_name}}
        description: {{subdirectory_description}}
        status: {{status}}

files:  # トップレベルのファイル
  - {{filename}}:
      description: {{file_description}}
      status: {{status}}
      exports:  # 公開する型や関数（オプショナル）
        - {{export_name}}: {{export_description}}
      functions:  # 関数定義（オプショナル）
        - name: {{function_name}}
          description: {{function_description}}
          params:
            - name: {{param_name}}
              type: {{param_type}}
              description: {{param_description}}
          return:
            type: {{return_type}}
            description: {{return_description}}
      types:  # 型定義（オプショナル）
        - {{type_name}}: {{type_description}}
      constants:  # 定数定義（オプショナル）
        - {{constant_name}}: {{constant_description}}

# モジュール定義（オプショナル）
modules:
  {{module_name}}:
    description: {{module_description}}
    status: {{status}}
    platform: {{platform_name}}  # プラットフォーム固有の場合
    functions:
      - {{function_name}}
    types:
      - {{type_name}}
    platform_specific:  # プラットフォーム固有の定義
      - {{platform_specific_item}}

# 依存関係
dependencies:
  internal:  # 内部依存関係（他のstructure.yamlへの参照）
    - path: {{relative_path_to_structure_yaml}}  # 例: ../core/structure.yaml
      name: {{component_name}}  # 例: raql-core
      version: {{version_requirement}}  # 例: ^0.1.0
      description: {{dependency_description}}
      child_structures:  # 子ディレクトリのstructure.yaml
        - path: {{child_directory}}/structure.yaml
          description: {{child_component_description}}
  external:  # 外部依存関係（ライブラリ）
    required:  # 必須の依存関係
      - name: {{dependency_name}}
        version: {{version_requirement}}
        description: {{dependency_description}}
    optional:  # オプショナルの依存関係
      - name: {{dependency_name}}
        version: {{version_requirement}}
        description: {{dependency_description}}
        features:  # オプショナル機能の依存関係
          - {{feature_name}}

# 機能定義
features:
  - {{feature_name}}: {{feature_description}}

# プラットフォームサポート
platforms:
  - {{platform_name}}: {{platform_requirements}}

# 以下はオプショナルセクション
api_endpoints:  # APIエンドポイントがある場合
  - path: {{endpoint_path}}
    method: {{http_method}}
    description: {{endpoint_description}}
    params:
      - name: {{param_name}}
        type: {{param_type}}
        required: {{required}}
        description: {{param_description}}

database_schemas:  # データベーススキーマがある場合
  - table: {{table_name}}
    description: {{table_description}}
    columns:
      - name: {{column_name}}
        type: {{column_type}}
        constraints: {{constraints}}
        description: {{column_description}}

configurations:  # 設定項目がある場合
  - key: {{config_key}}
    type: {{config_type}}
    required: {{required}}
    default: {{default_value}}
    description: {{config_description}}

# メタデータ（オプショナル）
metadata:
  maintainers:
    - {{maintainer_name}}
  repository: {{repository_url}}
  documentation: {{documentation_url}}

# 規約
# 1. status値は implemented, in_progress, planned のいずれかを使用
# 2. ディレクトリパスは常に/から始める
# 3. 説明は簡潔かつ具体的に記述
# 4. バージョンはセマンティックバージョニングに従う
# 5. プラットフォーム固有の実装は明示的に記述
# 6. 依存関係は必須とオプショナルを分けて記述
# 7. APIエンドポイントはRESTful規約に従う
# 8. データベーススキーマは正規化規則に従う`
