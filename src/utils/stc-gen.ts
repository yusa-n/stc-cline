import * as fs from "fs/promises"
import * as path from "path"
import { buildApiHandler } from "../api"
import { ApiConfiguration } from "../shared/api"
import { parseSourceCodeForDefinitionsTopLevel } from "../services/tree-sitter"
import { Anthropic } from "@anthropic-ai/sdk"
import { template } from "./template.stc"

export async function generateStructureYamlRecursively(rootPath: string, apiConfiguration: ApiConfiguration) {
	// APIハンドラーの設定
	const api = buildApiHandler(apiConfiguration)

	// プロジェクトのコード解析
	const definitions = await parseSourceCodeForDefinitionsTopLevel(rootPath)

	// システムプロンプトとメッセージを準備
	const systemPrompt = "あなたはプロジェクトの構造をYAML形式で記述するエキスパートです。"
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: `
以下のプロジェクト情報からstc.yamlを生成してください。
テンプレートに従って、必要な情報を埋めてください。

プロジェクト情報:
${JSON.stringify(definitions, null, 2)}

テンプレート:
${template}

生成時の注意点:
1. プロジェクトの構造を正確に反映すること
2. 関数や型の説明は具体的に記述すること
3. ステータスは実装状況に応じて適切に設定すること
4. 依存関係は package.json などから正確に抽出すること
5. オプショナルなセクションは、関連する情報がある場合のみ含めること
`,
		},
	]

	// 生成AIを使用してYAMLを生成
	let generatedYaml = ""
	for await (const chunk of api.createMessage(systemPrompt, messages)) {
		if (chunk.type === "text") {
			generatedYaml += chunk.text
		}
	}

	// 生成されたYAMLを保存
	const stcYamlPath = path.join(rootPath, "stc.yaml")
	await fs.writeFile(stcYamlPath, generatedYaml)

	return {
		success: true,
		message: "stc.yamlの生成が完了しました",
		path: stcYamlPath,
	}
}
