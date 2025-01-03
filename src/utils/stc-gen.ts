import * as fs from "fs/promises"
import * as path from "path"
import { buildApiHandler } from "../api"
import { ApiConfiguration } from "../shared/api"
import { parseSourceCodeForDefinitionsTopLevel } from "../services/tree-sitter"
import { Anthropic } from "@anthropic-ai/sdk"
import { template } from "./template.stc"
import { listFiles } from "../services/glob/list-files"

async function analyzeFile(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const ext = path.extname(filePath).toLowerCase()

		// ファイルタイプに応じた解析
		switch (ext) {
			case ".md":
				// Markdownファイルの場合、最初の見出しを説明として使用
				const mdMatch = content.match(/^#\s*(.+)$/m)
				return mdMatch ? mdMatch[1] : "Markdown documentation file"
			case ".json":
				// package.jsonの場合、依存関係情報を抽出
				if (path.basename(filePath) === "package.json") {
					const pkg = JSON.parse(content)
					return JSON.stringify({
						name: pkg.name,
						version: pkg.version,
						dependencies: pkg.dependencies,
						devDependencies: pkg.devDependencies,
					})
				}
				return "JSON configuration file"
			case ".yaml":
			case ".yml":
				// YAMLファイルの説明を生成
				return "YAML configuration file"
			case ".ts":
			case ".js":
			case ".tsx":
			case ".jsx":
				// TypeScript/JavaScriptファイルのトップレベルコメントを抽出
				const jsMatch = content.match(/\/\*\*([\s\S]*?)\*\//)
				return jsMatch ? jsMatch[1].replace(/\s*\*\s*/g, " ").trim() : "Source code file"
			default:
				return "Project file"
		}
	} catch (error) {
		console.error(`Error analyzing file ${filePath}:`, error)
		return "Project file"
	}
}

interface GenerateStructureYamlResult {
	success: boolean
	message: string
	path: string
	tokensIn?: number
	tokensOut?: number
	cost?: number
}

export async function generateStructureYamlRecursively(
	rootPath: string,
	apiConfiguration: ApiConfiguration,
): Promise<GenerateStructureYamlResult> {
	// APIハンドラーの設定
	const api = buildApiHandler(apiConfiguration)

	// プロジェクトのコード解析
	const definitions = await parseSourceCodeForDefinitionsTopLevel(rootPath)

	// ファイル解析情報の収集
	const [allFiles, _] = await listFiles(rootPath, true, 200)
	const fileAnalysis: { [key: string]: string } = {}

	for (const file of allFiles) {
		if (!file.endsWith("/") && !path.basename(file).startsWith(".")) {
			fileAnalysis[file] = await analyzeFile(file)
		}
	}

	// システムプロンプトとメッセージを準備
	const systemPrompt =
		"あなたはプロジェクトの構造をYAML形式で記述するエキスパートです。\n" +
		"以下の規則に従ってYAMLを生成してください：\n" +
		"1. YAMLのみを出力し、説明文は一切出力しないでください\n" +
		"2. ディレクトリ構造は階層的に表現してください\n" +
		"3. 各ディレクトリ内のファイルはそのディレクトリの下に正しくネストしてください\n" +
		"4. .DS_Store や .keep などのシステムファイルは除外してください\n" +
		"5. stc.yaml ファイルは各ディレクトリに生成されるため、それらも構造に含めてください\n" +
		"6. ファイルエントリには必ず description と status を含めてください\n" +
		"7. マークダウンの装飾は出力しないでください"

	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: `以下のプロジェクト情報からstc.yamlを生成してください。
テンプレートに従って、必要な情報を埋めてください。
YAMLのみを出力してください。マークダウンの装飾は出力しないでください。

プロジェクト情報:
${JSON.stringify(definitions, null, 2)}

テァイル解析情報:
${JSON.stringify(fileAnalysis, null, 2)}

テンプレート:
${template}

生成時の注意点:
1. プロジェクトの構造を正確に反映すること
2. 関数や型の説明は具体的に記述すること
3. ステータスは実装状況に応じて適切に設定すること
4. 依存関係は package.json などから正確に抽出すること
5. オプショナルなセクションは、関連する情報がある場合のみ含めること
6. 情報がない場合はそのセクション自体を出力しないこと
7. コメントは出力しないこと
8. .DS_Store や .keep などのシステムファイルは除外すること
9. 各ディレクトリには stc.yaml ファイルが含まれることを考慮すること
10. 各ファイルエントリには必ず description と status を含めること
11. ファイルパスはディレクトリ名を含めないこと（例：snake.svg は正しく、img/snake.svg は誤り）
12. ファイル解析情報を使用して、より詳細な説明を生成すること

出力例:
name: example-project
version: 0.1.0
status: implemented

directories:
  - name: /img
    description: Image assets directory
    status: implemented
    files:
      - snake.svg:
          description: Snake animation SVG
          status: implemented
      - stc.yaml:
          description: Structure to Code YAML file for img directory
          status: implemented

files:
  - README.md:
      description: Project documentation
      status: implemented
  - stc.yaml:
      description: Root Structure to Code YAML file
      status: implemented

no talk; just output yaml.`,
		},
	]

	let totalTokensIn = 0
	let totalTokensOut = 0
	let totalCost = 0

	// 生成AIを使用してYAMLを生成
	let generatedYaml = ""
	for await (const chunk of api.createMessage(systemPrompt, messages)) {
		if (chunk.type === "text") {
			generatedYaml += chunk.text
		} else if (chunk.type === "usage") {
			totalTokensIn += chunk.inputTokens
			totalTokensOut += chunk.outputTokens
			totalCost += chunk.totalCost ?? 0
		}
	}

	// 生成されたYAMLを保存
	const stcYamlPath = path.join(rootPath, "stc.yaml")
	await fs.writeFile(stcYamlPath, generatedYaml)

	// 子ディレクトリのstc.yamlを生成
	const directories = allFiles.filter((file: string) => file.endsWith("/")).map((dir: string) => dir.slice(0, -1))

	for (const dir of directories) {
		// ディレクトリ固有の定義を取得
		const dirDefinitions = await parseSourceCodeForDefinitionsTopLevel(dir)

		// ディレクトリ内のファイル解析
		const dirFileAnalysis: { [key: string]: string } = {}
		for (const file of Object.keys(fileAnalysis)) {
			if (file.startsWith(dir)) {
				const relativePath = path.relative(dir, file)
				dirFileAnalysis[relativePath] = fileAnalysis[file]
			}
		}

		// ディレクトリ用のメッセージを準備
		const dirMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: `このディレクトリ（${path.relative(rootPath, dir)}）のstc.yamlを生成してください。
テンプレートに従って、必要な情報を埋めてください。
YAMLのみを出力してください。

プロジェクト情報:
${JSON.stringify(dirDefinitions, null, 2)}

テァイル解析情報:
${JSON.stringify(dirFileAnalysis, null, 2)}

テンプレート:
${template}

生成時の注意点:
1. このディレクトリ固有の構造を反映すること
2. 親ディレクトリとの関係性を考慮すること
3. コメントは出力しないこと
4. .DS_Store や .keep などのシステムファイルは除外すること
5. ファイル解析情報を使用して、より詳細な説明を生成すること

no talk; just output yaml.`,
			},
		]

		// ディレクトリ用のYAMLを生成
		let dirYaml = ""
		for await (const chunk of api.createMessage(systemPrompt, dirMessages)) {
			if (chunk.type === "text") {
				dirYaml += chunk.text
			} else if (chunk.type === "usage") {
				totalTokensIn += chunk.inputTokens
				totalTokensOut += chunk.outputTokens
				totalCost += chunk.totalCost ?? 0
			}
		}

		// ディレクトリのstc.yamlを保存
		const dirStcYamlPath = path.join(dir, "stc.yaml")
		await fs.writeFile(dirStcYamlPath, dirYaml)
	}

	return {
		success: true,
		message: "stc.yamlの生成が完了しました",
		path: stcYamlPath,
		tokensIn: totalTokensIn,
		tokensOut: totalTokensOut,
		cost: totalCost,
	}
}
