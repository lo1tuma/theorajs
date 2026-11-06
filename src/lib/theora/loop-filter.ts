import { shiftSignedRight } from '../stream/integer-arithmetic.ts';
import type { FrameMappings } from './frame-mappings.ts';
import {
    type BlockPosition,
    type FramePlanes,
    type PlaneView,
    BLOCK_EDGE,
    blockPosition,
    createPlaneViews,
    planeForBlock
} from './frame-planes.ts';

import type { Header } from './header.ts';

const DOUBLE_LIMIT = 2;
const RESPONSE_WEIGHT = 3;
const RESPONSE_ROUNDING = 4;
const RESPONSE_BITS = 3;
const EDGE_OFFSET = 2;
const SAMPLE_MAXIMUM = 255;

type FilterCoding = { readonly header: Header; readonly flags: readonly number[]; readonly quality: number; };
type FilterEdge = { readonly start: number; readonly step: number; readonly stride: number; };
type BlockFilter = { readonly plane: PlaneView; readonly position: BlockPosition; readonly limit: number; };

export function limitFilterResponse(response: number, limit: number): number {
    if (-limit < response && response < limit) {
        return response;
    }
    const doubled = limit * DOUBLE_LIMIT;
    if (Math.abs(response) >= doubled) {
        return 0;
    }
    return response <= -limit ? -response - doubled : -response + doubled;
}

function clampSample(value: number): number {
    return Math.min(SAMPLE_MAXIMUM, Math.max(0, value));
}

function filterSamples(data: DataView, position: number, step: number, limit: number): void {
    const first = data.getUint8(position);
    const second = data.getUint8(position + step);
    const third = data.getUint8(position + EDGE_OFFSET * step);
    const fourth = data.getUint8(position + RESPONSE_WEIGHT * step);
    const response = shiftSignedRight(
        first - RESPONSE_WEIGHT * second + RESPONSE_WEIGHT * third - fourth + RESPONSE_ROUNDING,
        RESPONSE_BITS
    );
    const adjustment = limitFilterResponse(response, limit);
    data.setUint8(position + step, clampSample(second + adjustment));
    data.setUint8(position + EDGE_OFFSET * step, clampSample(third - adjustment));
}

function filterEdge(data: DataView, edge: FilterEdge, limit: number): void {
    for (let offset = 0; offset < BLOCK_EDGE; offset += 1) {
        filterSamples(data, edge.start + offset * edge.stride, edge.step, limit);
    }
}

function filterLeftEdge(block: BlockFilter): void {
    filterEdge(block.plane.data, {
        start: block.position.y * block.plane.width + block.position.x - EDGE_OFFSET,
        step: 1,
        stride: block.plane.width
    }, block.limit);
}

function filterBottomEdge(block: BlockFilter): void {
    filterEdge(block.plane.data, {
        start: (block.position.y - EDGE_OFFSET) * block.plane.width + block.position.x,
        step: block.plane.width,
        stride: 1
    }, block.limit);
}

function filterPriorEdges(block: BlockFilter): void {
    if (block.position.x > 0) {
        filterLeftEdge(block);
    }
    if (block.position.y > 0) {
        filterBottomEdge(block);
    }
}

function filterFollowingEdges(
    block: BlockFilter,
    raster: number,
    flags: readonly number[],
    mappings: FrameMappings
): void {
    if (block.position.x + BLOCK_EDGE < block.plane.width && flags[mappings.rasterToCodedOrder(raster + 1)] === 0) {
        filterLeftEdge({ ...block, position: { x: block.position.x + BLOCK_EDGE, y: block.position.y } });
    }
    if (
        block.position.y + BLOCK_EDGE < block.plane.height &&
        flags[mappings.rasterToCodedOrder(raster + block.plane.width / BLOCK_EDGE)] === 0
    ) {
        filterBottomEdge({ ...block, position: { x: block.position.x, y: block.position.y + BLOCK_EDGE } });
    }
}

export function filterReconstructedFrame(frame: FramePlanes, coding: FilterCoding, mappings: FrameMappings): void {
    const planes = createPlaneViews(frame, coding.header);
    const limit = coding.header.loopFilterLimit(coding.quality);
    const coded = Array
        .from({ length: coding.header.blockCount }, function (_value, raster) {
            return raster;
        })
        .filter(function (raster) {
            return coding.flags[mappings.rasterToCodedOrder(raster)] !== 0;
        });
    for (const raster of coded) {
        const plane = planeForBlock(planes, coding.header, raster);
        const block = { plane, position: blockPosition(plane, raster), limit };
        filterPriorEdges(block);
        filterFollowingEdges(block, raster, coding.flags, mappings);
    }
}
