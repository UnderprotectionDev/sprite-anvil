import type {
	SpecializedProfileContract,
	SpecializedProfileId,
} from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const builtinProfileNames: Record<
	SpecializedProfileId,
	readonly [string, string]
> = {
	character_creature_animation: [
		"Karakter, yaratık ve animasyon",
		"Character, creature, and animation",
	],
	object_weapon_equipment_states: [
		"Obje, silah, ekipman ve durum",
		"Object, weapon, equipment, and state",
	],
	icon: ["İkon", "Icon"],
	visual_effect_projectile_shadow_mark: [
		"Görsel efekt, fırlatılan nesne, gölge ve yüzey işareti",
		"Visual effect, projectile, shadow, and surface mark",
	],
	tileset_terrain_texture: [
		"Karo seti, arazi ve kesintisiz doku",
		"Tileset, terrain, and seamless texture",
	],
	background_parallax: [
		"Arka plan ve katmanlı kaydırma",
		"Background and parallax",
	],
	ui: ["Arayüz ekranı ve bileşeni", "UI screen and component"],
	portrait_logo_marketing: [
		"Portre, logo ve tanıtım görseli",
		"Portrait, logo, and marketing image",
	],
};

export function builtinProfileName(
	profileId: SpecializedProfileId,
	name: string
): string {
	const names = builtinProfileNames[profileId];
	return names && name === names[0] ? names[1] : name;
}

const builtinText: Readonly<Record<string, string>> = {
	"Aile ölçeği, perspektifi ve malzeme incelemesi":
		"Family scale, perspective, and material review",
	"Alan sınırları ve kimlikleri korunur.":
		"Area boundaries and identities are preserved.",
	"Ana Tasarım kimliği": "Canonical Design ID",
	"Ana Tasarım kimliği varsa aynen taşınır.":
		"The Canonical Design ID is preserved when present.",
	"Ana Tasarıma bağlı sürüm": "Version linked to a Canonical Design",
	Animasyon: "Animation",
	"Animasyonlu karo": "Animated tile",
	"Arayüz ailesi ve durum incelemesi": "UI family and state review",
	"Arazi bağlı karolar": "Tiles linked to terrain",
	"Arazi kimliği": "Terrain ID",
	"Arazi referansı kararlı kimlikle korunur.":
		"The terrain reference retains its stable ID.",
	"Arka plan çeşidi": "Background variant",
	"Atlas alanı": "Atlas region",
	"Atlas dikdörtgeni piksel düzleminde korunur.":
		"The atlas rectangle is preserved in pixel coordinates.",
	"Açık ve koyu zeminde hedef boyut testi":
		"Target size test on light and dark backgrounds",
	"Bağlantı kimliği çözümlenebilir kaldığında korunur.":
		"The link ID is preserved when it can be resolved.",
	"Bağlı karakter veya zemin kimlikleri korunur.":
		"Linked character or ground IDs are preserved.",
	"Başlangıç koordinatları tanımlı piksel düzleminde korunur.":
		"Origin coordinates are preserved in the defined pixel space.",
	"Başlangıç noktası": "Origin",
	"Bileşen kimliği": "Component ID",
	"Bileşen kimliği ekran bağlantılarında kararlı kalır.":
		"The component ID remains stable in screen links.",
	"Bilinçli taşma izin bilgisi açıkça korunur.":
		"The explicit overflow permission is preserved.",
	"Birim sürümü": "Unit Version",
	"Doku tekrar eksenleri": "Texture repeat axes",
	"Dokuz parçalı germe payları": "Nine-slice stretch margins",
	"Doğal ölçü": "Natural size",
	"Durum kimliği": "State ID",
	"Durum kimliği tüm geçiş ve dışa aktarım kayıtlarında korunur.":
		"The state ID is preserved across transitions and exports.",
	"Döngü biçimi": "Loop mode",
	"Döngü biçimi dışa aktarım ve yeniden okumada korunur.":
		"The loop mode is preserved on export and readback.",
	"Döngü ve kırpma biçimi": "Loop and crop mode",
	"Döngü ve kırpma tercihleri korunur.":
		"Loop and crop settings are preserved.",
	"Dönüş noktası": "Pivot",
	"Efekt karelerinin sırası roundtrip boyunca korunur.":
		"Effect frame order is preserved through the roundtrip.",
	"Efekt karesi": "Effect frame",
	"Efekt sözleşmesi": "Effect contract",
	"Efekt sürümü": "Effect version",
	"Ekran ve bileşen bağlantısı": "Screen and component link",
	"Ekrana bağlı bileşen": "Component linked to a screen",
	"Genişlik ve yükseklik piksel birimiyle korunur.":
		"Width and height are preserved in pixels.",
	"Genişlik ve yükseklik piksel olarak korunur.":
		"Width and height are preserved in pixels.",
	"Gerilebilen panel veya çerçeve": "Stretchable panel or frame",
	"Geçiş ve görünür tekrar incelemesi":
		"Transition and visible repetition review",
	"Göreli hız": "Relative speed",
	"Göreli kaydırma hızı değer ve birimiyle korunur.":
		"Relative scrolling speed and its unit are preserved.",
	"Görsel Dünya bağlantısı tam kimlikle korunur.":
		"The exact Visual World link is preserved.",
	"Görsel Dünya kimliği": "Visual World ID",
	"Görsel merkezden ayrı yerleşim noktası korunur.":
		"The placement point is preserved separately from the visual center.",
	"Güvenli alan": "Safe area",
	"Güvenli alan aynı koordinat düzleminde korunur.":
		"The safe area is preserved in the same coordinate space.",
	"Hedef görüntü oranı": "Target aspect ratio",
	"Hedef ölçü, germe ve metin alanı testi":
		"Target size, stretch, and text area test",
	"Her animasyon": "Each animation",
	"Her animasyon karesi": "Each animation frame",
	"Her arayüz bileşeni": "Each UI component",
	"Her arka plan katmanı": "Each background layer",
	"Her bileşen durumu": "Each component state",
	"Her durum birimi": "Each state unit",
	"Her efekt animasyonu": "Each effect animation",
	"Her efekt karesi": "Each effect frame",
	"Her efekt örneği": "Each effect instance",
	"Her ekran veya bileşen": "Each screen or component",
	"Her görsel sürümü": "Each image version",
	"Her ikon sürümü": "Each icon version",
	"Her karo birimi": "Each tile unit",
	"Her kullanım çeşidi": "Each usage variant",
	"Her yön birimi": "Each direction unit",
	"Her yön ve kare grubu": "Each direction and frame group",
	"Hücre dışına taşma izni": "Cell overflow permission",
	"Kare alanı": "Frame region",
	"Kare bölgesi kaynak görsel koordinatlarında korunur.":
		"The frame region is preserved in source image coordinates.",
	"Kare kimliği": "Frame ID",
	"Kare kimliği içe aktarma ve yeniden okumada aynı kalır.":
		"The frame ID remains unchanged on import and readback.",
	"Kare kimliği ve sırası roundtrip boyunca korunur.":
		"Frame identity and order are preserved through the roundtrip.",
	"Kare süresi": "Frame duration",
	"Kare süresi pozitif milisaniye olarak korunur.":
		"Frame duration is preserved as positive milliseconds.",
	"Kare sırası": "Frame order",
	"Kare ve süre bilgileri varsa aynen taşınır.":
		"Frame and duration data are preserved when present.",
	"Kare veya animasyon": "Frame or animation",
	"Kare veya birim": "Frame or unit",
	"Karelerin animasyon içindeki sırası korunur.":
		"Frame order within the animation is preserved.",
	"Karo kimliği": "Tile ID",
	"Karo kimliği atlas ve komşuluk kayıtlarında sabit kalır.":
		"The tile ID remains stable in atlas and adjacency records.",
	"Karo veya arazi kuralı": "Tile or terrain rule",
	Katman: "Layer",
	"Katman Asset Version kimliği": "Layer Asset Version ID",
	"Katman kimliği": "Layer ID",
	"Katman kimliği dışa aktarımda ve yeniden okumada korunur.":
		"The layer ID is preserved on export and readback.",
	"Katman sırası": "Layer order",
	"Katman sırası korunur.": "Layer order is preserved.",
	"Katmanlı kaydırma oynatma testi": "Parallax scrolling playback test",
	"Katmanın tam Asset Version kimliği dışa aktarımda ve yeniden okumada korunur.":
		"The exact layer Asset Version ID is preserved on export and readback.",
	"Kaynak genişlik ve yüksekliği piksel olarak korunur.":
		"Source width and height are preserved in pixels.",
	"Kaynak görsel": "Source image",
	"Kaynak ölçüsü": "Source size",
	"Kenar payları ve koordinat temelinin bilgisi korunur.":
		"Margins and their coordinate basis are preserved.",
	"Kesintisiz doku": "Seamless texture",
	"Kimlik, ifade ve kırpma incelemesi": "Identity, expression, and crop review",
	"Kimlik, siluet ve ekipman tarafı incelemesi":
		"Identity, silhouette, and equipment side review",
	"Komşu kimlikleri ve yönleri korunur.":
		"Neighbor IDs and directions are preserved.",
	"Komşuluk eşlemesi": "Adjacency mapping",
	"Koordinatlar tanımlı piksel düzleminde korunur.":
		"Coordinates are preserved in the defined pixel space.",
	"Kullanım amacı": "Usage purpose",
	"Kullanım amacı kararlı kimlikle korunur.":
		"The usage purpose retains its stable ID.",
	"Kullanım bağlantıları": "Usage links",
	"Kullanım çeşidi": "Usage variant",
	"Köşe, koridor ve tekrar test haritası":
		"Corner, corridor, and repetition test map",
	"Küçük kullanım, arka plan ve kırpma testi":
		"Small-size, background, and crop test",
	"Kırpma ve güvenli alan": "Crop and safe area",
	"Kırpma ve güvenli alan aynı koordinat düzleminde korunur.":
		"Crop and safe area are preserved in the same coordinate space.",
	"Mantıksal genişlik ve yükseklik korunur.":
		"Logical width and height are preserved.",
	"Mantıksal ölçü": "Logical size",
	"Metin güvenli alanı": "Text safe area",
	"Metin sınırı seçilen koordinat düzleminde korunur.":
		"The text boundary is preserved in the selected coordinate space.",
	"Metin taşıyan bileşen": "Component containing text",
	"Noktalar kararlı kimlikleriyle korunur.": "Points retain their stable IDs.",
	"Normal, seçili ve diğer durumlar açık kimlikle taşınır.":
		"Normal, selected, and other states retain explicit IDs.",
	"Olay bağlantıları": "Event links",
	"Olay kimliği": "Event ID",
	"Olay kimliği ve zamanlaması korunur.":
		"Event identity and timing are preserved.",
	"Onaylı karakter ve zeminle sahne testi":
		"Scene test with approved character and ground",
	"Oyuncu görünürlüğü ve kontrast incelemesi":
		"Player visibility and contrast review",
	"Portre, logo veya tanıtım amacı kararlı değerle korunur.":
		"The portrait, logo, or marketing purpose retains its stable value.",
	"Renk alanı": "Color space",
	"Renk alanı içe aktarma ve yeniden okumada korunur.":
		"The color space is preserved on import and readback.",
	"Sabitleme noktaları": "Mount points",
	"Sahip animasyon ve olay eşzamanlama testi":
		"Owner animation and event synchronization test",
	"Sahip animasyona bağlı efekt": "Effect linked to owner animation",
	"Sahip olay kimliği eşleşiyorsa aynen taşınır.":
		"The matching owner event ID is preserved.",
	"Seçilen ikon": "Selected icon",
	"Seçilen tekrar eksenleri korunur.":
		"The selected repeat axes are preserved.",
	"Siluet, okunurluk ve aile ölçeği incelemesi":
		"Silhouette, readability, and family scale review",
	"Süre pozitif milisaniye olarak korunur.":
		"Duration is preserved as positive milliseconds.",
	"Sıralama değeri aynen taşınır.": "The order value is preserved.",
	"Tam Varlık Sürümü kimliği taşınır.":
		"The exact Asset Version ID is preserved.",
	"Varlık Sürümü": "Asset Version",
	"Varlık ailesi": "Asset Family",
	"Varlık sürümü": "Asset Version",
	"Yön bağlantısı korunur ve yön kimliği uydurulmaz.":
		"The direction link is preserved without inventing an ID.",
	"Yön eşlemesi sessizce değiştirilmez.":
		"Direction mapping is not silently changed.",
	"Yön kimliği": "Direction ID",
	"Zemin noktası": "Ground point",
	"Zemin teması ve Y sıralama koordinatları ayrıdır.":
		"Ground contact and Y sort coordinates are separate.",
	"Zemin ve sıralama noktaları": "Ground and sort points",
	"Zemine temas koordinatı korunur.":
		"The ground contact coordinate is preserved.",
	"Zeminlerde okunurluk ve zamanlama incelemesi":
		"Readability and timing review on backgrounds",
	"Çarpışma alanları": "Collision areas",
	"Çok yönlü oynatma ve sahne geçişi":
		"Multi-direction playback and scene transition",
	"Ölçekleme kuralı": "Scale rule",
	"Ölçekleme tercihi okunabilir bir değer olarak korunur.":
		"The scaling preference is preserved as a readable value.",
	"Ölçüler piksel olarak korunur.": "Dimensions are preserved in pixels.",
	"Şeffaf, açık veya koyu arka plan seçimi taşınır.":
		"The transparent, light, or dark background choice is preserved.",
	"Şeffaflık alanı kayıpsız korunur.":
		"The transparency channel is preserved without loss.",
	"Şeffaflık verisi": "Transparency data",
};

/** Historical contract options carry their stable profile ID in the revision ID. */
export function builtinProfileRevisionName(
	revisionId: string,
	name: string
): string {
	const catalog = specializedProfileContractCatalog.find((item) =>
		revisionId.startsWith(`${item.profileId}@`)
	);
	return catalog ? builtinProfileName(catalog.profileId, name) : name;
}

/** Translate only unchanged fields of known catalog items; custom text is preserved. */
export function builtinProfileItemText(
	contract: SpecializedProfileContract,
	section:
		| "metadataFields"
		| "humanReviews"
		| "usageTests"
		| "rules"
		| "exportMappings",
	itemId: string,
	field: string,
	value: string
): string {
	const catalog = specializedProfileContractCatalog.find(
		(item) => item.profileId === contract.profileId
	);
	const original = catalog?.[section].find((item) => item.id === itemId);
	if (
		!(original && field in original) ||
		Reflect.get(original, field) !== value
	) {
		return value;
	}
	return builtinText[value] ?? value;
}

export function builtinProfilePresentation(
	contract: SpecializedProfileContract
): SpecializedProfileContract {
	function present<T extends { id: string }>(
		section:
			| "metadataFields"
			| "humanReviews"
			| "usageTests"
			| "rules"
			| "exportMappings",
		item: T
	): T {
		return Object.fromEntries(
			Object.entries(item).map(([key, value]) => [
				key,
				typeof value === "string"
					? builtinProfileItemText(contract, section, item.id, key, value)
					: value,
			])
		) as T;
	}
	return {
		...contract,
		name: builtinProfileName(contract.profileId, contract.name),
		metadataFields: contract.metadataFields.map((item) =>
			present("metadataFields", item)
		),
		humanReviews: contract.humanReviews.map((item) =>
			present("humanReviews", item)
		),
		usageTests: contract.usageTests.map((item) => present("usageTests", item)),
		rules: contract.rules.map((item) => present("rules", item)),
		exportMappings: contract.exportMappings.map((item) =>
			present("exportMappings", item)
		),
	};
}
